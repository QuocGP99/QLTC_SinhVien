# backend/app/models/category.py
from __future__ import annotations
from sqlalchemy import UniqueConstraint, CheckConstraint, ForeignKey
from sqlalchemy.orm import relationship
from . import BaseModel, db

class Category(BaseModel):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("user_id", "name", "type", name="uq_categories_user_name_type"),
        CheckConstraint("type IN ('expense','income', 'saving','budget')", name="ck_category_type"),
    )

    name = db.Column(db.String(120), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'expense' | 'income'
    color_hex = db.Column(db.String(16))
    icon_key = db.Column(db.String(64))

    user_id = db.Column(
        db.Integer,
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=True,  # NULL = danh mục chung hệ thống
        index=True,
    )

    user = relationship("User", back_populates="categories")
    expenses = relationship("Expense", back_populates="category")
    incomes = relationship("Income", back_populates="category")
