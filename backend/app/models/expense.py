# backend/app/models/expense.py
from __future__ import annotations
from sqlalchemy import ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from . import BaseModel, db

class Expense(BaseModel):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expense_amount_pos"),
        Index("idx_expenses_user_spent", "user_id", "spent_at"),
        Index("idx_expenses_user_category", "user_id", "category_id"),
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
    payment_method_id = db.Column(
        db.Integer,
        ForeignKey("payment_methods.id", onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    amount = db.Column(db.Numeric(12, 2), nullable=False)
    spent_at = db.Column(db.Date, nullable=False, index=True)
    note = db.Column(db.Text)

    user = relationship("User", back_populates="expenses")
    category = relationship("Category", back_populates="expenses")
    payment_method = relationship("PaymentMethod", back_populates="expenses")
