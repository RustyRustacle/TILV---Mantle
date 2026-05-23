import asyncio
import logging
import os
import uuid
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from eth_account.messages import encode_defunct
from web3 import Web3
import uvicorn

from invoice_ocr.ocr_processor import OCRProcessor
from risk_scoring.risk_model import RiskModel
from validation.invoice_validator import InvoiceValidator

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("TILV")

app = FastAPI(title="TILV AI Engine", version="1.0.0")

cors_origins_str = os.getenv("CORS_ORIGIN", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_str.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = set(
    ext.strip().lower()
    for ext in os.getenv("ALLOWED_EXTENSIONS", "pdf,png,jpg,jpeg").split(",")
)
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

ocr_processor = OCRProcessor()
risk_model = RiskModel()
validator = InvoiceValidator()


@app.get("/")
async def root():
    return {"service": "TILV AI Engine", "status": "running"}


@app.post("/process-invoice")
async def process_invoice(
    file: UploadFile = File(...),
    x_wallet_address: str = Header(None),
    x_wallet_signature: str = Header(None),
    x_signed_message: str = Header(None),
):
    if not x_wallet_address or not x_wallet_signature or not x_signed_message:
        raise HTTPException(status_code=401, detail="Wallet authentication headers required")

    try:
        message_obj = encode_defunct(text=x_signed_message)
        recovered = Web3().eth.account.recover_message(message_obj, signature=x_wallet_signature)
        if recovered.lower() != x_wallet_address.lower():
            raise HTTPException(status_code=401, detail="Invalid wallet signature")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=401, detail="Signature verification failed")

    temp_path = None
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type '.{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )

        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File exceeds {MAX_FILE_SIZE_MB} MB limit",
            )

        safe_name = f"{uuid.uuid4().hex}_{os.path.basename(file.filename)}"
        temp_path = os.path.join(os.getcwd(), safe_name)

        with open(temp_path, "wb") as f:
            f.write(contents)

        extracted_data = await asyncio.to_thread(ocr_processor.process, temp_path)
        validation_result = validator.validate(extracted_data)
        risk_score = risk_model.calculate_score(extracted_data)

        return {
            "success": True,
            "data": extracted_data,
            "validation": validation_result,
            "risk_score": risk_score,
        }

    except HTTPException:
        raise
    except Exception as e:
        log.exception("Invoice processing failed")
        raise HTTPException(status_code=500, detail="Internal processing error")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(app, host=host, port=port)
