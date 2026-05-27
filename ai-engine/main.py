import asyncio
import logging
import os
import uuid
import time
from collections import defaultdict
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
AI_SHARED_SECRET = os.getenv("AI_SHARED_SECRET", "")

# Magic bytes for MIME validation
MAGIC_BYTES = {
    "application/pdf": [b"\x25\x50\x44\x46\x2d"],
    "image/png": [b"\x89\x50\x4e\x47\x0d\x0a\x1a\x0a"],
    "image/jpeg": [
        b"\xff\xd8\xff\xe0",
        b"\xff\xd8\xff\xe1",
        b"\xff\xd8\xff\xe2",
    ],
}

# Simple in-memory rate limiter
rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 30

def check_rate_limit(key: str):
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    timestamps = rate_limit_store[key]
    rate_limit_store[key] = [t for t in timestamps if t > window_start]
    if len(rate_limit_store[key]) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Max 30 requests per minute.")
    rate_limit_store[key].append(now)

ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
}

def verify_mime_bytes(contents: bytes, declared_type: str):
    if declared_type not in MAGIC_BYTES:
        raise HTTPException(status_code=400, detail=f"File type '{declared_type}' not allowed")
    magics = MAGIC_BYTES[declared_type]
    if not any(contents.startswith(m) for m in magics):
        raise HTTPException(status_code=400, detail="File content does not match declared type")

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
    x_api_key: str = Header(None),
    request: Request = None,
):
    # Internal API key auth (backend→AI)
    if AI_SHARED_SECRET and x_api_key != AI_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    # Rate limiting by IP
    client_ip = request.client.host if request else "unknown"
    check_rate_limit(client_ip)

    # Wallet auth (either via internal shared secret or wallet signature)
    if not x_api_key or x_api_key != AI_SHARED_SECRET:
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

        # Verify content matches declared MIME type
        declared_mime = file.content_type or ""
        if declared_mime in ALLOWED_MIME_TYPES:
            verify_mime_bytes(contents, declared_mime)

        safe_name = f"{uuid.uuid4().hex}_{os.path.basename(file.filename)}"
        temp_path = os.path.join("/tmp", safe_name)

        loop = asyncio.get_event_loop()
        async with asyncio.Lock():
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
