# backend/app/models/income.py
from __future__ import annotations
from sqlalchemy import ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from . import BaseModel, db

class Income(BaseModel):
    __tablename__ = "incomes"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_income_amount_pos"),
        Index("idx_incomes_user_date", "user_id", "received_at"),
    )

    user_id = db.Column(
        db.Integer,
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id = db.Column(
        db.Integer,
        ForeignKey("categories.id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    amount = db.Column(db.Numeric(12, 2), nullable=False)
    received_at = db.Column(db.Date, nullable=False, index=True)
    note = db.Column(db.Text)

    user = relationship("User", back_populates="incomes")
    category = relationship("Category", back_populates="incomes")
