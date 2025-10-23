# backend/app/services/budget_service.py
from datetime import date
from calendar import monthrange
from sqlalchemy import func
from decimal import Decimal
from ..extensions import db
from ..models.expense import Expense
from ..models.budget import Budget

def _month_bounds(yyyy_mm: str):
    y, m = map(int, yyyy_mm.split("-"))
    start = date(y, m, 1)
    end = date(y, m, monthrange(y, m)[1])
    return start, end

def spend_used(user_id: int, category_id: int, yyyy_mm: str) -> float:
    """
    Tổng chi theo danh mục trong tháng (Expense.amount > 0; cột ngày: spent_at DATE)
    Trả về float để FE hiển thị/ tính %
    """
    start, end = _month_bounds(yyyy_mm)
    q = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.user_id == int(user_id))
        .filter(Expense.category_id == int(category_id))
        .filter(Expense.spent_at >= start)
        .filter(Expense.spent_at <= end)
    )
    val = q.scalar() or 0
    # val có thể là Decimal -> ép float
    try:
        return float(val)
    except Exception:
        return float(Decimal(val))

def budget_stats_row(b: Budget) -> dict:
    yyyy_mm = f"{int(b.period_year):04d}-{int(b.period_month):02d}"
    used = spend_used(b.user_id, b.category_id, yyyy_mm)
    limit = float(b.limit_amount or 0)
    remaining = limit - used
    percent = 0.0 if limit <= 0 else min(100.0, max(0.0, used / limit * 100.0))
    status = "ok"
    if limit > 0 and used >= limit:
        status = "over"
    elif percent >= 80.0:
        status = "warning"

    row = {
        "id": b.id,
        "user_id": b.user_id,
        "category_id": b.category_id,
        "category_name": getattr(b.category, "name", None),
        "month": yyyy_mm,
        "amount": round(limit, 2),
        "used": round(used, 2),
        "remaining": round(remaining, 2),
        "percent_used": round(percent, 2),
        "status": status,
    }
    # alias để FE cũ đọc được
    row["spent"] = row["used"]
    row["budget_amount"] = row["amount"]
    return row

def month_summary(user_id: int, yyyy_mm: str) -> dict:
    budgets = (Budget.query
               .filter_by(user_id=int(user_id))
               .filter(Budget.period_year == int(yyyy_mm[:4]),
                       Budget.period_month == int(yyyy_mm[5:7]))
               .all())
    total_budget = float(sum(float(b.limit_amount or 0) for b in budgets))
    total_used = 0.0
    for b in budgets:
        total_used += spend_used(user_id, b.category_id, yyyy_mm)

    total_remaining = total_budget - total_used
    percent = 0.0 if total_budget <= 0 else min(100.0, max(0.0, total_used / total_budget * 100.0))
    status = "ok"
    if total_budget > 0 and total_used >= total_budget:
        status = "over"
    elif percent >= 80.0:
        status = "warning"

    s = {
        "month": yyyy_mm,
        "total_budget": round(total_budget, 2),
        "total_used": round(total_used, 2),
        "total_remaining": round(total_remaining, 2),
        "percent_used": round(percent, 2),
        "status": status,
        "count_categories": len(budgets),
    }
    # alias cho FE
    s["total_amount"] = s["total_budget"]
    s["spent"] = s["total_used"]
    s["remaining"] = s["total_remaining"]
    return s
