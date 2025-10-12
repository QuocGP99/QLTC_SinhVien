# app/services/dashboard_service.py
from __future__ import annotations
from datetime import datetime
from dateutil.relativedelta import relativedelta
import math
import pytz
from sqlalchemy import func
from app.extensions import db
from app.models import Expense, Budget, Category, SavingsGoal

TZ = pytz.timezone("Asia/Bangkok")

def _month_range(month_ym: str):
    """
    Trả về [start_local, end_local) theo Asia/Bangkok (naive DB cũng OK).
    Vì bạn đang dùng SQLite và cột Expense.date là DateTime(timezone=True) nhưng
    thường lưu naive theo local, ta sẽ query theo mốc local cho chắc.
    """
    start_local = TZ.localize(datetime.strptime(month_ym, "%Y-%m"))
    end_local = start_local + relativedelta(months=1)
    return start_local, end_local

def get_month_summary(user_id: int, month_ym: str):
    start, end = _month_range(month_ym)

    # --- EXPENSES + TOP CATEGORIES ---
    # Join luôn Category để lấy tên, tránh N+1
    exp_rows = (
        db.session.query(
            Expense.category_id,
            func.coalesce(func.sum(Expense.amount), 0).label("amt"),
            Category.name.label("cat_name")
        )
        .join(Category, Category.id == Expense.category_id, isouter=True)
        .filter(
            Expense.user_id == user_id,
            Expense.date >= start,
            Expense.date < end
        )
        .group_by(Expense.category_id, Category.name)
        .all()
    )
    total_expense = int(sum(int(r.amt or 0) for r in exp_rows))

    # top-3 theo số tiền
    top = sorted(exp_rows, key=lambda r: int(r.amt or 0), reverse=True)[:3]
    top_categories = [
        {
            "category_id": r.category_id or 0,
            "category_name": (r.cat_name or ""),
            "amount": int(r.amt or 0),
            "ratio": (float(r.amt) / total_expense) if total_expense else 0.0
        } for r in top
    ]

    # --- INCOME (chưa có bảng income) ---
    total_income = 0  # khi có Income model sẽ cộng thật

    # --- BUDGETS ---
    budgets = Budget.query.filter_by(user_id=user_id, month=month_ym).all()
    spent_by_cat = {int(r.category_id or 0): int(r.amt or 0) for r in exp_rows}
    by_category = []
    total_budget = 0
    total_spent_in_budgeted = 0
    for b in budgets:
        limit_amt = int(b.amount or 0)  # NOTE: field của bạn là amount
        spent = int(spent_by_cat.get(int(b.category_id), 0))
        total_budget += limit_amt
        total_spent_in_budgeted += spent
        progress = (spent / limit_amt) if limit_amt > 0 else 0.0
        status = "ok" if progress < 0.8 else ("warning" if progress <= 1.0 else "over")
        by_category.append({
            "category_id": b.category_id,
            "category_name": b.category.name if getattr(b, "category", None) else "",
            "limit": limit_amt,
            "spent": spent,
            "remaining": max(0, limit_amt - spent),
            "progress": round(progress, 4),
            "status": status
        })

    # --- SAVINGS GOALS ---
    # Model của bạn: target_amount (Numeric), current_amount (Numeric), deadline (Date)
    goals = SavingsGoal.query.filter_by(user_id=user_id).all()
    g_items = []
    total_target = 0
    total_saved = 0
    today_local = TZ.localize(datetime.now().replace(microsecond=0)).date()

    for g in goals:
        target = int(float(g.target_amount or 0))
        saved  = int(float(g.current_amount or 0))
        total_target += target
        total_saved  += saved

        # months_left: dùng hàm có sẵn; đảm bảo tối thiểu 1 nếu còn hạn
        ml = g.months_left(today_local)
        months_left = max(1, ml) if g.deadline and ml >= 0 else 1

        remain = max(0, target - saved)
        recommended = math.ceil(remain / months_left) if months_left > 0 else remain

        g_items.append({
            "goal_id": g.id,
            "name": g.name or "",
            "target_amount": target,
            "saved_amount": saved,
            "progress": round((saved / target) if target > 0 else 0.0, 4),
            "deadline": g.deadline.isoformat() if g.deadline else None,
            "recommended_monthly": int(recommended)
        })

    payload = {
        "success": True,
        "version": "2025-10-1",
        "context": {
            "month": month_ym,
            "currency": "VND",
            "timezone": "Asia/Bangkok",
            "generated_at": datetime.now(TZ).isoformat()
        },
        "data": {
            "totals": {
                "income": int(total_income),
                "expense": int(total_expense),
                "net": int(total_income - total_expense)
            },
            "top_categories": top_categories,
            "budget": {
                "total_budget": int(total_budget),
                "total_spent_in_budgeted": int(total_spent_in_budgeted),
                "remaining": int(max(0, total_budget - total_spent_in_budgeted)),
                "by_category": by_category
            },
            "savings": {
                "total_target": int(total_target),
                "total_saved": int(total_saved),
                "overall_progress": round((total_saved / total_target) if total_target > 0 else 0.0, 4),
                "goals": g_items
            }
        }
    }
    return payload
