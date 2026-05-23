import os
import re

import pytesseract
from pdf2image import convert_from_path
from PIL import Image


class OCRProcessor:
    def __init__(self):
        tesseract_cmd = os.getenv("TESSERACT_CMD")
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    def process(self, file_path: str) -> dict:
        # NOTE: In production, also validate Content-Type from the upload
        # endpoint to prevent MIME-type mismatch attacks.
        if file_path.lower().endswith(".pdf"):
            try:
                images = convert_from_path(file_path)
            except Exception as e:
                raise RuntimeError(f"Failed to convert PDF: {e}")
            text = ""
            for img in images:
                text += pytesseract.image_to_string(img)
        else:
            try:
                img = Image.open(file_path)
            except Exception as e:
                raise RuntimeError(f"Failed to open image: {e}")
            text = pytesseract.image_to_string(img)

        return self._parse_invoice_text(text)

    def _parse_invoice_text(self, text: str) -> dict:
        patterns = {
            "invoice_number": r"(?:Invoice\s*(?:No|Number|#)?\s*[:.]?\s*)([A-Z0-9][A-Z0-9/\-]{2,})",
            "date": r"(?:Date\s*[:.]?\s*)(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            "due_date": r"(?:Due\s*Date\s*[:.]?\s*)(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            "total_amount": r"(?:Total\s*[:.]?\s*)(?:USD|USDT|USDC)?\s*\$?\s*([\d,]+\.?\d*)",
            "buyer_name": r"(?:Bill\s*To|Customer|Buyer)[\s:]*([A-Za-z0-9\s.&]+?)(?:\n|$)",
            "seller_name": r"(?:From|Seller|Vendor)[\s:]*([A-Za-z0-9\s.&]+?)(?:\n|$)",
        }

        result = {}
        for key, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            result[key] = match.group(1).strip() if match else None

        return result
