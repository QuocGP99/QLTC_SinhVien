from datetime import date, timedelta
from calendar import monthrange
from sqlalchemy import func
from ..extensions import db
from ..models.expense import Expense
from ..models.budget import Budget


def calculate_spending_velocity(user_id, category_id=None):
    today = date.today()
    first_day = today.replace(day=1)
    days_passed = today.day

    # Tổng chi từ đầu tháng tới hôm nay
    q = db.session.query(func.sum(Expense.amount)).filter(
        Expense.user_id == user_id,
        Expense.spent_at >= first_day,
        Expense.spent_at <= today
    )

    if category_id:
        q = q.filter(Expense.category_id == category_id)

    spent = q.scalar() or 0
    velocity = spent / max(1, days_passed)

    return float(velocity), float(spent)

def projected_overshoot(user_id, budget: Budget):
    today = date.today()

    velocity, spent = calculate_spending_velocity(user_id, budget.category_id)

    days_in_month = monthrange(today.year, today.month)[1]

    projected_total = velocity * days_in_month

    limit = float(budget.limit_amount)
    projected_total = float(projected_total)

    overshoot = projected_total - limit

    status = (
        "danger" if overshoot > limit * 0.15 else
        "warning" if overshoot > 0 else
        "safe"
    )

    return {
        "spent": float(spent),
        "velocity": round(float(velocity), 2),
        "projected_total": round(projected_total, 2),
        "limit": limit,
        "overshoot": round(overshoot, 2),
        "status": status,
    }
