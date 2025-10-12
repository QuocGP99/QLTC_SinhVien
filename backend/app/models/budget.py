from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from sqlalchemy import UniqueConstraint, Index, func
from ..extensions import db

@dataclass
class Budget(db.Model):  # nếu không dùng BaseModel, để db.Model là đủ
    __tablename__ = "budgets"
    id: int = db.Column(db.Integer, primary_key=True)

    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    category_id: int = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)

    # YYYY-MM cho mỗi tháng (dễ unique + query); nếu muốn kiểu Date, giữ là ngày 1 trong tháng
    month: str = db.Column(db.String(7), nullable=False)  # "2025-09"

    amount: float = db.Column(db.Float, nullable=False)   # hạn mức

    created_at = db.Column(db.DateTime, server_default=func.now())
    updated_at = db.Column(db.DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'category_id', 'month', name='uq_budget_user_cat_month'),
        Index('ix_budget_user_month', 'user_id', 'month'),
        Index('ix_budget_cat_month', 'category_id', 'month'),
    )

    user = db.relationship("User", backref=db.backref("budgets", lazy="dynamic"))
    category = db.relationship("Category", backref=db.backref("budgets", lazy="dynamic"))

    @staticmethod
    def month_key(d: date) -> str:
        return f"{d.year:04d}-{d.month:02d}"