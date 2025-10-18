# backend/app/models/budget.py
from __future__ import annotations
from sqlalchemy import ForeignKey, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from . import BaseModel, db

class Budget(BaseModel):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "category_id", "period_year", "period_month",
                         name="uq_budget_user_cat_year_month"),
        CheckConstraint("period_month BETWEEN 1 AND 12", name="ck_budget_month_1_12"),
        CheckConstraint("limit_amount > 0", name="ck_budget_limit_pos"),
        Index("idx_budgets_user_period", "user_id", "period_year", "period_month"),
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

    period_year = db.Column(db.Integer, nullable=False)
    period_month = db.Column(db.Integer, nullable=False)
    limit_amount = db.Column(db.Numeric(12, 2), nullable=False)
    note = db.Column(db.Text)

    user = relationship("User", back_populates="budgets")
    category = relationship("Category")

    # ---- alias 'limit' cho FE (đọc/ghi)
    @hybrid_property
    def limit(self):
        return float(self.limit_amount or 0)

    @limit.setter
    def limit(self, value):
        self.limit_amount = value

    # ---- chuẩn hoá data trả cho FE
    def to_dict(self, spent: float = 0.0) -> dict:
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category": self.category.name if self.category else None,
            "limit": float(self.limit_amount or 0),
            "spent": float(spent or 0),
        }
