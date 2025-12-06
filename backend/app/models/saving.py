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

    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(32))
    priority = db.Column(db.String(16), nullable=False, default="medium")

    target_amount = db.Column(db.Numeric(12, 2), nullable=False)
    current_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    monthly_contribution = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    deadline = db.Column(db.Date)
    status = db.Column(db.String(16), nullable=False, default="active")

    # NEW: bật/tắt tự động và chu kỳ
    auto_contribute = db.Column(db.Boolean, nullable=False, default=False)
    # 'monthly' | 'weekly'
    contribute_interval = db.Column(db.String(8), nullable=False, default="monthly")

    user = relationship("User", back_populates="savings_goals")

    # NEW: quan hệ lịch sử
    histories = relationship(
        "SavingsHistory",
        back_populates="goal",
        cascade="all, delete-orphan",
        lazy="dynamic",
        order_by="desc(SavingsHistory.created_at)",
    )

    @property
    def progress(self) -> float:
        if not self.target_amount or self.target_amount == 0:
            return 0.0
        return float(self.current_amount or 0) / float(self.target_amount)


class SavingsHistory(BaseModel):
    """
    Log tất cả tiền đã đi vào 1 mục tiêu tiết kiệm.
    Dùng cho:
      - hiển thị lịch sử trong modal
      - tính biểu đồ analytics
      - kiểm tra đã auto góp tháng/tuần này chưa
    """
    __tablename__ = "savings_history"
    __table_args__ = (
        Index("idx_savhist_user", "user_id"),
        Index("idx_savhist_goal", "goal_id"),
        Index("idx_savhist_created", "created_at"),
    )

    goal_id = db.Column(
        db.Integer,
        ForeignKey("savings_goals.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = db.Column(
        db.Integer,
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
    )

    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    # 'manual' hoặc 'auto'
    method = db.Column(db.String(20), nullable=False, default="manual")
    # 'monthly' hoặc 'weekly' (ghi lại thời điểm góp)
    interval = db.Column(db.String(8), nullable=False, default="monthly")
    note = db.Column(db.Text)

    goal = relationship("SavingsGoal", back_populates="histories")
    user = relationship("User")  # nếu bạn có back_populates ở User thì thêm sau
