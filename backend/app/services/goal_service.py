from decimal import Decimal, ROUND_UP
from datetime import date
from ..models.savings_goal import SavingsGoal
from ..extensions import db

class GoalAdvice:
    def __init__(self, per_month: Decimal, months_left: int, shortfall: Decimal, mode: str, note: str):
        self.per_month = per_month
        self.months_left = months_left
        self.shortfall = shortfall
        self.mode = mode          # "deadline_target" | "lump_sum" | "achieved" | "past_deadline"
        self.note = note

    def to_dict(self):
        return {
            "per_month": str(self.per_month),
            "months_left": self.months_left,
            "shortfall": str(self.shortfall),
            "mode": self.mode,
            "note": self.note,
        }

def _ceil_money(x: Decimal) -> Decimal:
    return (x.quantize(Decimal("0.01"), rounding=ROUND_UP))

def recommend_per_month(goal_id: int, today: date | None = None) -> GoalAdvice:
    today = today or date.today()
    goal: SavingsGoal = db.session.get(SavingsGoal, goal_id)
    if not goal:
        raise ValueError("Goal not found")

    shortfall = Decimal(goal.remaining_amount())
    if shortfall <= 0:
        return GoalAdvice(Decimal("0.00"), 0, Decimal("0.00"), "achieved", "Mục tiêu đã đạt hoặc dư.")

    months_left = goal.months_left(today)
    if months_left <= 0:
        # quá hạn → khuyến nghị đóng một lần (lump sum) phần thiếu
        return GoalAdvice(_ceil_money(shortfall), 0, shortfall, "past_deadline",
                          "Đã quá hạn. Cần nộp một lần để hoàn thành.")

    per_month = _ceil_money(shortfall / Decimal(months_left))
    return GoalAdvice(per_month, months_left, shortfall, "deadline_target",
                      f"Cần đều {months_left} tháng để đạt trước {goal.deadline.isoformat()}.")
