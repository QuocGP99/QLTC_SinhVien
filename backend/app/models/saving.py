# backend/app/models/saving.py
from __future__ import annotations
from sqlalchemy import ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from . import BaseModel, db

class SavingsGoal(BaseModel):
    __tablename__ = "savings_goals"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="ck_sg_target_pos"),
        CheckConstraint("current_amount >= 0", name="ck_sg_current_nonneg"),
        CheckConstraint("status IN ('active','paused','completed')", name="ck_sg_status"),
        CheckConstraint("priority IN ('low','medium','high')", name="ck_sg_priority"),
        Index("idx_savings_user", "user_id"),
        Index("idx_savings_status", "status"),
        Index("idx_savings_priority", "priority"),
        Index("idx_savings_deadline", "deadline"),
    )

    user_id = db.Column(
        db.Integer,
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # DB chuẩn tên: name, deadline
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)                        # thêm cho UI
    category = db.Column(db.String(32))                     # emergency/tech/...
    priority = db.Column(db.String(16), nullable=False, default="medium")
    target_amount = db.Column(db.Numeric(12, 2), nullable=False)
    current_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    monthly_contribution = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    deadline = db.Column(db.Date)                           # DB chuẩn tên: deadline
    status = db.Column(db.String(16), nullable=False, default="active")

    user = relationship("User", back_populates="savings_goals")

    @property
    def progress(self) -> float:
        if not self.target_amount or self.target_amount == 0:
            return 0.0
        return float(self.current_amount or 0) / float(self.target_amount)
