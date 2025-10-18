# app/services/budget_service.py
from datetime import date, datetime
from calendar import monthrange
from sqlalchemy import func
from ..extensions import db
from ..models.expense import Expense
from ..models.budget import Budget

def _month_bounds(yyyy_mm: str):
    # yyyy_mm = "2025-09"
    y, m = map(int, yyyy_mm.split("-"))
    start = date(y, m, 1)
    last_day = monthrange(y, m)[1]
    end = date(y, m, last_day)
    return start, end

def _expense_date_col():
    # Đổi tên cột ngày chi tiêu cho phù hợp model của bạn
    # Ưu tiên Expense.date (Date) -> nếu không có dùng Expense.spent_at (DateTime)
    if hasattr(Expense, "date"):
        return Expense.date
    return func.date(Expense.spent_at)

def spend_used(user_id: int, category_id: int, yyyy_mm: str) -> float:
    category_id = int(category_id)
    start, end = _month_bounds(yyyy_mm)
    date_col = _expense_date_col()
    q = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id)
        .filter(Expense.category_id == category_id)
        .filter(date_col >= start)
        .filter(date_col <= end)
    )
    return float(q.scalar() or 0.0)

def budget_stats_row(b: Budget) -> dict:
    used = spend_used(b.user_id, b.category_id, b.month)
    remaining = b.amount - used
    percent = 0.0 if b.amount <= 0 else min(100.0, max(0.0, used / b.amount * 100))
    status = "ok"
    if used >= b.amount:
        status = "over"
    elif percent >= 80.0:
        status = "warning"
    return {
        "id": b.id,
        "user_id": b.user_id,
        "category_id": b.category_id,
        "category_name": getattr(b.category, "name", None),
        "month": b.month,
        "amount": round(b.amount, 2),
        "used": round(used, 2),
        "remaining": round(remaining, 2),
        "percent_used": round(percent, 2),
        "status": status
    }

    row["spent"] = row["used"]
    row["budget_amount"] = row["amount"]
    return row

def month_summary(user_id: int, yyyy_mm: str) -> dict:
    # Tổng hợp toàn tháng (tổng hạn mức, tổng đã dùng, %)
    budgets = Budget.query.filter_by(user_id=user_id, month=yyyy_mm).all()
    total_budget = sum(b.amount for b in budgets)
    total_used = sum(spend_used(user_id, b.category_id, yyyy_mm) for b in budgets)
    total_remaining = total_budget - total_used
    percent = 0.0 if total_budget <= 0 else min(100.0, max(0.0, total_used / total_budget * 100))
    status = "ok"
    if total_used >= total_budget and total_budget > 0:
        status = "over"
    elif percent >= 80.0:
        status = "warning"
    return {
        "month": yyyy_mm,
        "total_budget": round(total_budget, 2),
        "total_used": round(total_used, 2),
        "total_remaining": round(total_remaining, 2),
        "percent_used": round(percent, 2),
        "status": status,
        "count_categories": len(budgets)
    }

    s["total_amount"] = s["total_budget"]
    s["spent"] = s["total_used"]
    s["remaining"] = s["total_remaining"]
    return s




