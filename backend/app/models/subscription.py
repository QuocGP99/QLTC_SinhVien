# backend/app/models/subscription.py
from __future__ import annotations
from sqlalchemy import ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from dateutil.relativedelta import relativedelta
from datetime import datetime, date
from . import BaseModel, db


class Subscription(BaseModel):
    """
    Model cho Subscription Tracker - quản lý các dịch vụ theo dõi/đăng ký hàng kỳ
    Ví dụ: Netflix, Spotify, GitHub, Adobe, v.v.
    """

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_subscription_price_pos"),
        CheckConstraint("cycle_months > 0", name="ck_subscription_cycle_pos"),
        CheckConstraint(
            "status IN ('active','paused','cancelled')", name="ck_subscription_status"
        ),
        Index("idx_subscriptions_user", "user_id"),
        Index("idx_subscriptions_status", "status"),
        Index("idx_subscriptions_next_billing", "next_billing_date"),
    )

    user_id = db.Column(
        db.Integer,
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)

    # Giá tiền (lưu theo VND, đơn vị integer)
    price = db.Column(db.Integer, nullable=False)  # VND

    # Chu kỳ lặp lại (tính theo tháng)
    # Ví dụ: 1 = hàng tháng, 3 = hàng 3 tháng, 12 = hàng năm
    cycle_months = db.Column(db.Integer, nullable=False, default=1)

    # Danh mục/Thể loại
    category = db.Column(db.String(50), default="Other")
    # Ví dụ: Entertainment, Work, Productivity, Streaming, etc.

    # Ngày bắt đầu
    start_date = db.Column(db.Date, nullable=False)

    # Ngày thanh toán kỳ tiếp theo
    next_billing_date = db.Column(db.Date, nullable=False)

    # Logo/Icon URL
    logo_url = db.Column(db.String(500))

    # Trạng thái: active, paused, cancelled
    status = db.Column(db.String(20), nullable=False, default="active")

    # Ghi chú thêm
    notes = db.Column(db.Text)

    # Quan hệ với User
    user = relationship("User", back_populates="subscriptions")

    def calculate_next_billing(self) -> date:
        """
        Tính ngày thanh toán tiếp theo dựa trên chu kỳ
        Đảm bảo next_billing_date luôn nằm trong tương lai
        """
        today = date.today()
        safe_cycle = (
            self.cycle_months if self.cycle_months and self.cycle_months > 0 else 1
        )

        while self.next_billing_date <= today:
            self.next_billing_date += relativedelta(months=+safe_cycle)

        return self.next_billing_date

    def days_until_billing(self) -> int:
        """Số ngày còn lại cho kỳ thanh toán tiếp theo"""
        delta = self.next_billing_date - date.today()
        return max(0, delta.days)

    def is_overdue(self) -> bool:
        """Kiểm tra xem kỳ thanh toán đã quá hạn hay chưa"""
        return self.next_billing_date < date.today() and self.status == "active"

    def __repr__(self) -> str:
        return f"<Subscription {self.name} ({self.category})>"
