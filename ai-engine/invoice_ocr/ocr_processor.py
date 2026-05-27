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
            "invoice_number": [
                r"(?:Invoice\s*(?:No|Number|#)?\s*[:.]?\s*)([A-Z0-9][A-Z0-9/\-]{2,})",
                r"(?:Faktur\s*Pajak|FP)\s*[:.]?\s*([0-9]{4}\.[0-9]{3}\.[0-9]{2}\.[0-9]{6})",
                r"(?:Nomor|No\.?\s*Faktur)\s*[:.]?\s*([A-Z0-9][A-Z0-9/\-]{2,})",
                r"(?:INV|INVOICE)\s*[:\-]\s*([A-Z0-9][A-Z0-9/\-]{2,})",
            ],
            "date": [
                r"(?:Date\s*[:.]?\s*)(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
                r"(?:Tanggal|Tgl)\s*[:.]?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
                r"(?:Date\s*[:.]?\s*)(\d{1,2}\s+[A-Za-z]+\s+\d{4})",
            ],
            "due_date": [
                r"(?:Due\s*Date\s*[:.]?\s*)(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
                r"(?:Jatuh\s*Tempo|Jt\s*Tempo)\s*[:.]?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            ],
            "total_amount": [
                r"(?:Total|Jumlah)\s*[:.]?\s*(?:USD|USDT|USDC)?\s*\$?\s*([\d,]+\.?\d*)",
                r"(?:Total|Jumlah)\s*[:.]?\s*Rp\.?\s*([\d,]+\.?\d*)",
                r"Rp\.?\s*([\d,]+\.?\d{0,2})",
            ],
            "buyer_name": [
                r"(?:Bill\s*To|Customer|Buyer)[\s:]*([A-Za-z0-9\s.&]+?)(?:\n|$)",
                r"(?:Kepada|Yth|Customer|Pembeli)[\s:]*([A-Za-z0-9\s.&]+?)(?:\n|$)",
            ],
            "seller_name": [
                r"(?:From|Seller|Vendor)[\s:]*([A-Za-z0-9\s.&]+?)(?:\n|$)",
                r"(?:Dari|Penjual|Vendor|Supplier)[\s:]*([A-Za-z0-9\s.&]+?)(?:\n|$)",
            ],
            "npwp": [
                r"NPWP\s*[:.]?\s*(\d{2}\.\d{3}\.\d{3}\.\d{1}\-\d{3}\.\d{3})",
                r"NPWP\s*[:.]?\s*(\d{15})",
            ],
            "ppn": [
                r"PPN\s*[:.]?\s*([\d,]+\.?\d*)",
                r"(?:Pajak|VAT|PPN)\s*[:.]?\s*([\d,]+\.?\d*)",
            ],
            "dpp": [
                r"DPP\s*[:.]?\s*Rp\.?\s*([\d,]+\.?\d*)",
                r"(?:Dasar\s*Pengenaan\s*Pajak)\s*[:.]?\s*Rp\.?\s*([\d,]+\.?\d*)",
            ],
        }

        result = {}
        for key, pattern_list in patterns.items():
            result[key] = None
            for pattern in pattern_list:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    result[key] = match.group(1).strip()
                    break

        return result
