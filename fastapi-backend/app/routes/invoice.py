from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func
from ..db import get_db
from ..models.invoice import Invoice
from ..schemas.invoice import InvoiceCreate, InvoiceResponse

router = APIRouter(prefix="/invoices", tags=["Invoices"])

@router.post("/", response_model=InvoiceResponse)
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db)):
    db_invoice = Invoice(**data.dict())
    db.add(db_invoice)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invoice already exists")
    db.refresh(db_invoice)
    return db_invoice

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    db_invoice = db.query(Invoice).filter(Invoice.invoice_id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return db_invoice

@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(invoice_id: str, update_data: InvoiceCreate, db: Session = Depends(get_db)):
    db_invoice = db.query(Invoice).filter(Invoice.invoice_id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    for key, value in update_data.dict().items():
        setattr(db_invoice, key, value)
    db_invoice.updated_at = func.now()
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.delete("/{invoice_id}", response_model=dict)
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    db_invoice = db.query(Invoice).filter(Invoice.invoice_id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(db_invoice)
    db.commit()
    return {"detail": "Invoice deleted"}
