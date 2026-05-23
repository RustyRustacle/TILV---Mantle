import re
from datetime import datetime

class InvoiceValidator:
    def __init__(self):
        pass
    
    def validate(self, invoice_data: dict) -> dict:
        """Validate extracted invoice data"""
        
        errors = []
        warnings = []
        
        # Validate invoice number
        if not invoice_data.get('invoice_number'):
            errors.append("Missing invoice number")
        elif not re.match(r'^[A-Z0-9\-]+$', invoice_data['invoice_number']):
            warnings.append("Invoice number format may be incorrect")
        
        # Validate date
        if not invoice_data.get('date'):
            errors.append("Missing invoice date")
        else:
            if not self._validate_date_format(invoice_data['date']):
                warnings.append("Invoice date format may be incorrect")
        
        # Validate amount
        if not invoice_data.get('total_amount'):
            errors.append("Missing total amount")
        else:
            try:
                amount = float(invoice_data['total_amount'].replace(',', ''))
                if amount <= 0:
                    errors.append("Total amount must be greater than 0")
            except (ValueError, AttributeError):
                errors.append("Invalid total amount format")
        
        # Validate buyer/seller
        if not invoice_data.get('buyer_name'):
            warnings.append("Missing buyer name")
        if not invoice_data.get('seller_name'):
            warnings.append("Missing seller name")
        
        is_valid = len(errors) == 0
        
        return {
            "is_valid": is_valid,
            "errors": errors,
            "warnings": warnings
        }
    
    def _validate_date_format(self, date_str: str) -> bool:
        """Check if date string is a real calendar date."""
        formats = [
            "%m/%d/%Y", "%m/%d/%y",
            "%m-%d-%Y", "%m-%d-%y",
            "%Y-%m-%d", "%Y/%m/%d",
            "%d/%m/%Y", "%d/%m/%y",
            "%d-%m-%Y", "%d-%m-%y",
        ]
        for fmt in formats:
            try:
                datetime.strptime(date_str.strip(), fmt)
                return True
            except ValueError:
                continue
        return False
