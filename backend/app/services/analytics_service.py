# backend/app/services/analytics_service.py
from datetime import date, timedelta
from sqlalchemy import func
from flask import current_app  # ⬅️ thêm dòng này
from ..extensions import db
from ..models.expense import Expense
from ..models.income import Income
from ..models.budget import Budget
from ..models.category import Category

# ----------------- helper chung cho tháng -----------------
def _month_expr(col):
    """
    Trả về biểu thức lấy tháng dạng YYYY-MM từ cột ngày.
    - SQLite: dùng strftime('%Y-%m', col)
    - PostgreSQL / MySQL: dùng to_char(col, 'YYYY-MM')
    """
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")  # vd: postgresql+psycopg2://...
    engine = uri.split(":", 1)[0].lower() if uri else ""         # 'postgresql+psycopg2' -> 'postgresql+psycopg2' (ko sao)

    # đơn giản hoá: chỉ check bắt đầu bằng sqlite
    if engine.startswith("sqlite"):
        return func.strftime("%Y-%m", col)
    else:
        # postgres, mysql...
        return func.to_char(col, "YYYY-MM")


# ----------------- Range resolver -----------------
def get_range_dates(range_key: str):
    """
    Trả về (start_date, end_date) cho các preset:
    - current_month: từ ngày 1 đầu tháng đến hôm nay
    - last_month: nguyên tháng trước
    - last_3_months / last_6_months / last_12_months: từ đầu mốc đó -> hôm nay
    """
    today = date.today()

    if range_key == "current_month":
        start = today.replace(day=1)
        end = today

    elif range_key == "last_month":
        first_this = today.replace(day=1)
        end = first_this - timedelta(days=1)
        start = end.replace(day=1)

    elif range_key == "last_3_months":
        # đơn giản hoá: lùi 90 ngày từ đầu tháng hiện tại
        start = today.replace(day=1) - timedelta(days=90)
        end = today

    elif range_key == "last_6_months":
        start = today.replace(day=1) - timedelta(days=180)
        end = today

    elif range_key == "last_12_months":
        start = today.replace(day=1) - timedelta(days=365)
        end = today

    else:
        # fallback
        start = today.replace(day=1)
        end = today

    return start, end


def _sum_expense(user_id, start_date, end_date):
    return (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user_id,
            Expense.spent_at >= start_date,
            Expense.spent_at <= end_date,
        )
        .scalar()
        or 0
    )


def _sum_income(user_id, start_date, end_date):
    return (
        db.session.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(
            Income.user_id == user_id,
            Income.received_at >= start_date,
            Income.received_at <= end_date,
        )
        .scalar()
        or 0
    )


def _count_expense(user_id, start_date, end_date):
    return (
        db.session.query(func.count(Expense.id))
        .filter(
            Expense.user_id == user_id,
            Expense.spent_at >= start_date,
            Expense.spent_at <= end_date,
        )
        .scalar()
        or 0
    )


def _count_income(user_id, start_date, end_date):
    return (
        db.session.query(func.count(Income.id))
        .filter(
            Income.user_id == user_id,
            Income.received_at >= start_date,
            Income.received_at <= end_date,
        )
        .scalar()
        or 0
    )


def _collect_daily_expense(user_id, start_date, end_date):
    rows = (
        db.session.query(
            func.date(Expense.spent_at).label("d"),
            func.sum(Expense.amount).label("total"),
        )
        .filter(
            Expense.user_id == user_id,
            Expense.spent_at >= start_date,
            Expense.spent_at <= end_date,
        )
        .group_by(func.date(Expense.spent_at))
        .order_by(func.date(Expense.spent_at))
        .all()
    )
    return [{"date": d, "total": float(t)} for d, t in rows]


def _collect_monthly_expense(user_id, end_date, limit_n=6):
    """
    Lấy xu hướng chi tiêu theo tháng (tối đa limit_n tháng gần nhất tính tới end_date)
    dạng: [{month: "2025-10", total: ...}, ...]
    """
    m_expr = _month_expr(Expense.spent_at)

    q = (
        db.session.query(
            m_expr.label("m"),
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        )
        .filter(
            Expense.user_id == user_id,
            Expense.spent_at <= end_date,
        )
        .group_by(m_expr)
        .order_by(m_expr.desc())  # lấy tháng mới nhất trước
    )

    if limit_n:
        q = q.limit(limit_n)

    rows = q.all()

    # rows hiện tại: [(m, total), ...] theo DESC → đảo lại cho FE
    rows = list(reversed(rows))

    data = [{"month": m, "total": float(t)} for m, t in rows]
    return data


def _collect_top_categories(user_id, start_date, end_date, top_n=5):
    """
    Top danh mục chi tiêu (expense) trong khoảng: [{category, total}, ...]
    """
    rows = (
        db.session.query(
            Category.name.label("cat_name"),
            func.sum(Expense.amount).label("total"),
        )
        .join(Category, Category.id == Expense.category_id)
        .filter(
            Expense.user_id == user_id,
            Expense.spent_at >= start_date,
            Expense.spent_at <= end_date,
            Category.type == "expense",
        )
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
        .limit(top_n)
        .all()
    )
    return [{"category": n, "total": float(t)} for n, t in rows]


def _calc_budget_sum_for_range(user_id, start_date, end_date):
    """
    Lấy tổng hạn mức ngân sách của tất cả các tháng nằm trong [start_date, end_date].
    Ý tưởng: duyệt qua từng tháng trong khoảng, cộng SUM(limit_amount) của tháng đó.
    """
    total_budget = 0
    cur = start_date.replace(day=1)

    while cur <= end_date:
        y = cur.year
        m = cur.month
        month_budget = (
            db.session.query(func.coalesce(func.sum(Budget.limit_amount), 0))
            .filter(
                Budget.user_id == user_id,
                Budget.period_year == y,
                Budget.period_month == m,
            )
            .scalar()
            or 0
        )
        total_budget += month_budget

        # tăng 1 tháng
        if m == 12:
            cur = cur.replace(year=y + 1, month=1)
        else:
            cur = cur.replace(month=m + 1)

    return total_budget


def build_analytics_summary(user_id: int, range_key: str = "current_month"):
    # 1. xác định khoảng ngày
    start_date, end_date = get_range_dates(range_key)
    num_days = (end_date - start_date).days + 1

    # 2. tổng thu / chi hiện tại
    total_income = _sum_income(user_id, start_date, end_date)
    total_expense = _sum_expense(user_id, start_date, end_date)

    # 3. xu hướng chi tiêu (so với giai đoạn liền trước có cùng độ dài)
    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=num_days - 1)
    prev_expense = _sum_expense(user_id, prev_start, prev_end)

    if prev_expense == 0:
        month_trend_pct = 0
    else:
        month_trend_pct = (total_expense - prev_expense) / prev_expense  # âm nếu giảm

    # 4. hiệu quả ngân sách
    total_budget_in_range = _calc_budget_sum_for_range(user_id, start_date, end_date)
    if total_budget_in_range == 0:
        budget_eff = 0
    else:
        budget_eff = total_expense / total_budget_in_range  # 0..1

    # 5. tỷ lệ tiết kiệm
    saved_amount = max(0, total_income - total_expense)
    if total_income == 0:
        saving_rate = 0
    else:
        saving_rate = saved_amount / total_income  # 0..1

    # 6. chi trung bình/ngày + số giao dịch
    avg_per_day = (total_expense / num_days) if num_days > 0 else 0
    tx_count = _count_expense(user_id, start_date, end_date) + _count_income(
        user_id, start_date, end_date
    )

    # 7. datasets cho chart
    daily_expense = _collect_daily_expense(user_id, start_date, end_date)
    monthly_expense = _collect_monthly_expense(user_id, end_date, limit_n=6)
    top_categories = _collect_top_categories(user_id, start_date, end_date, top_n=5)

    # 8. đóng gói JSON cho FE
    return {
        "kpi": {
            "month_trend_pct": month_trend_pct,
            "budget_efficiency": budget_eff,
            "saving_rate": saving_rate,
            "avg_per_day": avg_per_day,
            "tx_count": tx_count,
        },
        "daily_expense": daily_expense,
        "monthly_expense": monthly_expense,
        "top_categories": top_categories,
        "range": {
            "from": start_date.isoformat(),
            "to": end_date.isoformat(),
            "days": num_days,
            "preset": range_key,
        },
    }
