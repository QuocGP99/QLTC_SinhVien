from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import CheckConstraint, Enum as SAEnum
from ..extensions import db

GoalStatus = db.Enum('planned', 'in_progress', 'achieved', 'cancelled', name='goal_status')

class SavingsGoal(db.Model):
    __tablename__ = "savings_goals"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name = db.Column(db.String(120), nullable=False)               # tiêu đề mục tiêu
    target_amount = db.Column(db.Numeric(14, 2), nullable=False)   # số tiền mục tiêu
    current_amount = db.Column(db.Numeric(14, 2), nullable=False, default=0)  # đã tích lũy
    deadline = db.Column(db.Date, nullable=False)                  # hạn chót đạt mục tiêu
    priority = db.Column(db.Integer, nullable=False, default=3)    # 1..5 (1 cao nhất)
    status = db.Column(GoalStatus, nullable=False, default='planned')

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("target_amount >= 0"),
        CheckConstraint("current_amount >= 0"),
        CheckConstraint("priority BETWEEN 1 AND 5"),
    )

    def remaining_amount(self) -> Decimal:
        return max(Decimal(self.target_amount) - Decimal(self.current_amount), Decimal("0.00"))

    def months_left(self, today: date | None = None) -> int:
        """Số 'tháng lịch' còn lại (tối thiểu 1 nếu vẫn còn hạn trong tháng hiện tại)."""
        today = today or date.today()
        if self.deadline <= today:
            return 0
        y1, m1 = today.year, today.month
        y2, m2 = self.deadline.year, self.deadline.month
        months = (y2 - y1) * 12 + (m2 - m1)
        # nếu vẫn còn trong tháng deadline (ngày hôm nay < deadline), đảm bảo >=1
        return max(1, months if today.day <= self.deadline.day else months - 1)
