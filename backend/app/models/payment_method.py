# backend/app/models/payment_method.py
from __future__ import annotations
from sqlalchemy import UniqueConstraint, ForeignKey
from sqlalchemy.orm import relationship
from . import BaseModel, db

class PaymentMethod(BaseModel):
    __tablename__ = "payment_methods"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_payment_methods_user_name"),
    )

    name = db.Column(db.String(120), nullable=False)
    user_id = db.Column(
        db.Integer,
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=True,  # NULL = dùng chung
        index=True,
    )

    user = relationship("User", back_populates="payment_methods")
    expenses = relationship("Expense", back_populates="payment_method")
