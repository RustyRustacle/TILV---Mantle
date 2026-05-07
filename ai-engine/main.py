from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from datetime import datetime

from invoice_ocr.ocr_processor import OCRProcessor
from risk_scoring.risk_model import RiskModel
from validation.invoice_validator import InvoiceValidator

app = FastAPI(title="TILV AI Engine", version="1.0.0")

cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ocr_processor = OCRProcessor()
risk_model = RiskModel()
validator = InvoiceValidator()

@app.get("/")
async def root():
    return {"service": "TILV AI Engine", "status": "running"}

@app.post("/process-invoice")
async def process_invoice(file: UploadFile = File(...)):
    try:
        # Save uploaded file
        contents = await file.read()
        filename = f"temp_{datetime.now().timestamp()}_{file.filename}"
        
        with open(filename, "wb") as f:
            f.write(contents)
        
        # Process invoice
        extracted_data = ocr_processor.process(filename)
        validation_result = validator.validate(extracted_data)
        risk_score = risk_model.calculate_score(extracted_data)
        
        # Cleanup
        os.remove(filename)
        
        return {
            "success": True,
            "data": extracted_data,
            "validation": validation_result,
            "risk_score": risk_score
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
