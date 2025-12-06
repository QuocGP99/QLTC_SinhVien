# backend/app/routes/analytics.py
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from ..extensions import db
from ..models.expense import Expense
from ..models.income import Income
from ..models.category import Category
from ..models.payment_method import PaymentMethod
from ..models.budget import Budget
from ..models.saving import SavingsGoal, SavingsHistory 
from ..services.forecast_service import build_expense_forecast 
from ..services.financial_health_service import compute_financial_health


bp = Blueprint("analytics_api", __name__, url_prefix="/api/analytics")


# ========== helpers chung ==========
def _uid():
    u = get_jwt_identity()
    if isinstance(u, dict):
        u = u.get("id")
    return u


def _parse_ymd(s: str | None, default: date) -> date:
    if not s:
        return default
    return datetime.strptime(s, "%Y-%m-%d").date()


def _range_from_preset(preset: str):
    today = date.today()
    if preset == "current_month":
        return today.replace(day=1), today
    if preset == "last_month":
        first_this = today.replace(day=1)
        last_month_end = first_this - timedelta(days=1)
        start = last_month_end.replace(day=1)
        return start, last_month_end
    if preset == "last_3_months":
        m = today.month - 2
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        return date(y, m, 1), today
    if preset == "last_6_months":
        m = today.month - 5
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        return date(y, m, 1), today
    return today.replace(day=1), today  # default


# ========== 1. CHI TIÊU ==========
@bp.get("/expenses")
@jwt_required()
def expenses():
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    today = date.today()
    d_from = _parse_ymd(request.args.get("from"), today.replace(day=1))
    d_to = _parse_ymd(request.args.get("to"), today)
    cat_id = request.args.get("category_id", type=int)
    cat_name = request.args.get("category", type=str)

    q = (
        db.session.query(
            Expense.spent_at,
            Expense.amount,
            Expense.note,
            Category.name.label("category_name"),
            PaymentMethod.name.label("method_name"),
        )
        .join(Category, Category.id == Expense.category_id)
        # quan trọng: outerjoin để những expense không có payment_method vẫn lên
        .outerjoin(PaymentMethod, PaymentMethod.id == Expense.payment_method_id)
        .filter(
            Expense.user_id == uid,
            Expense.spent_at >= d_from,
            Expense.spent_at <= d_to,
        )
        .order_by(Expense.spent_at.desc(), Expense.id.desc())
    )
    if cat_id:
        q = q.filter(Expense.category_id == cat_id)
    elif cat_name:
        q = q.filter(Category.name == cat_name)

    rows = [
        {
            "date": spent_at.isoformat(),
            "desc": note or "",
            "category": cat or "Khác",
            "method": method or "",
            "amount": float(amount or 0),
            "kind": "expense",
        }
        for spent_at, amount, note, cat, method in q.all()
    ]
    return jsonify({"items": rows}), 200


# ========== 2. THU NHẬP ==========
@bp.get("/incomes")
@jwt_required()
def incomes():
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    today = date.today()
    d_from = _parse_ymd(request.args.get("from"), today.replace(day=1))
    d_to = _parse_ymd(request.args.get("to"), today)
    cat_id = request.args.get("category_id", type=int)
    cat_name = request.args.get("category", type=str)

    q = (
        db.session.query(
            Income.received_at,
            Income.amount,
            Income.note,
            Category.name.label("category_name"),
        )
        .join(Category, Category.id == Income.category_id)
        .filter(
            Income.user_id == uid,
            Income.received_at >= d_from,
            Income.received_at <= d_to,
        )
        .order_by(Income.received_at.desc(), Income.id.desc())
    )
    if cat_id:
        q = q.filter(Income.category_id == cat_id)
    elif cat_name:
        q = q.filter(Category.name == cat_name)

    rows = [
        {
            "date": recv.isoformat(),
            "desc": note or "",
            "category": cat or "Thu nhập",
            "method": "",
            "amount": float(amount or 0),
            "kind": "income",
        }
        for recv, amount, note, cat in q.all()
    ]
    return jsonify({"items": rows}), 200


# ========== 3. GIAO DỊCH (THU + CHI) ==========
@bp.get("/transactions")
@jwt_required()
def transactions():
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    today = date.today()
    d_from = _parse_ymd(request.args.get("from"), today.replace(day=1))
    d_to = _parse_ymd(request.args.get("to"), today)

    cat_id = request.args.get("category_id", type=int)
    cat_name = request.args.get("category", type=str)

    # ----- chi tiêu -----
    q_exp = (
        db.session.query(
            Expense.spent_at,
            Expense.amount,
            Expense.note,
            Category.name.label("category_name"),
            PaymentMethod.name.label("method_name"),
        )
        .join(Category, Category.id == Expense.category_id)
        .outerjoin(PaymentMethod, PaymentMethod.id == Expense.payment_method_id)
        .filter(
            Expense.user_id == uid,
            Expense.spent_at >= d_from,
            Expense.spent_at <= d_to,
        )
    )
    if cat_id:
        q_exp = q_exp.filter(Expense.category_id == cat_id)
    elif cat_name:
        q_exp = q_exp.filter(Category.name == cat_name)

    exp_rows = [
        {
            "date": spent_at.isoformat(),
            "desc": note or "",
            "category": cat or "Khác",
            "method": method or "",
            "amount": float(amount or 0),
            "kind": "expense",
        }
        for spent_at, amount, note, cat, method in q_exp.all()
    ]

    # ----- thu nhập -----
    q_inc = (
        db.session.query(
            Income.received_at,
            Income.amount,
            Income.note,
            Category.name.label("category_name"),
        )
        .join(Category, Category.id == Income.category_id)
        .filter(
            Income.user_id == uid,
            Income.received_at >= d_from,
            Income.received_at <= d_to,
        )
    )
    if cat_id:
        q_inc = q_inc.filter(Income.category_id == cat_id)
    elif cat_name:
        q_inc = q_inc.filter(Category.name == cat_name)

    inc_rows = [
        {
            "date": received_at.isoformat(),
            "desc": note or "",
            "category": cat or "Thu nhập",
            "method": "",
            "amount": float(amount or 0),
            "kind": "income",
        }
        for received_at, amount, note, cat in q_inc.all()
    ]

    rows = exp_rows + inc_rows
    rows.sort(key=lambda x: x["date"], reverse=True)

    return jsonify(rows), 200


# ========== 4. SUMMARY (KPI + PIE) ==========
@bp.get("/summary")
@jwt_required()
def summary():
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    q_from = request.args.get("from")
    q_to = request.args.get("to")
    q_range = request.args.get("range", "current_month")
    q_type = (request.args.get("type") or "all").lower()

    today = date.today()
    if q_from and q_to:
        d_from = _parse_ymd(q_from, today.replace(day=1))
        d_to = _parse_ymd(q_to, today)
    else:
        d_from, d_to = _range_from_preset(q_range)

    # ====== tổng chi trong khoảng ======
    total_expense = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(
            Expense.user_id == uid,
            Expense.spent_at >= d_from,
            Expense.spent_at <= d_to,
        )
        .scalar()
        or 0.0
    )

    # ====== tổng thu trong khoảng ======
    total_income = (
        db.session.query(func.coalesce(func.sum(Income.amount), 0.0))
        .filter(
            Income.user_id == uid,
            Income.received_at >= d_from,
            Income.received_at <= d_to,
        )
        .scalar()
        or 0.0
    )

    # ====== lấy chi để dựng daily / monthly ======
    start_5 = d_from - timedelta(days=150)
    all_exp = (
        Expense.query.filter(
            Expense.user_id == uid,
            Expense.spent_at >= start_5,
            Expense.spent_at <= d_to,
        ).all()
    )

    # --- daily_expense (cho chart “Xu hướng chi theo ngày”) ---
    daily_map = {}
    for e in all_exp:
      if not e.spent_at:
        continue
      key = e.spent_at.isoformat()
      daily_map[key] = daily_map.get(key, 0.0) + float(e.amount or 0)

    daily_expense = [
        {"date": day, "total": total}
        for day, total in sorted(daily_map.items())
        if d_from.isoformat() <= day <= d_to.isoformat()
    ]

    # --- monthly_expense (cho chart tháng) ---
    monthly_map = {}
    for e in all_exp:
        if not e.spent_at:
            continue
        ym = e.spent_at.strftime("%Y-%m")
        monthly_map[ym] = monthly_map.get(ym, 0.0) + float(e.amount or 0)

    monthly_expense = [
        {"month": ym, "total": amt}
        for ym, amt in sorted(monthly_map.items(), key=lambda x: x[0])
    ][-5:]

    # ====== chi theo danh mục ======
    expense_by_category = []
    if q_type in ("all", "expense"):
        exp_cat_rows = (
            db.session.query(
                Category.name.label("category"),
                func.coalesce(func.sum(Expense.amount), 0.0).label("total"),
            )
            .join(Category, Category.id == Expense.category_id)
            .filter(
                Expense.user_id == uid,
                Expense.spent_at >= d_from,
                Expense.spent_at <= d_to,
                Category.type == "expense",
            )
            .group_by(Category.name)
            .order_by(func.sum(Expense.amount).desc())
            .all()
        )
        expense_by_category = [
            {"category": r.category or "Khác", "total": float(r.total or 0)}
            for r in exp_cat_rows
        ]

    # ====== thu theo danh mục ======
    income_by_category = []
    if q_type in ("all", "income"):
        inc_cat_rows = (
            db.session.query(
                Category.name.label("category"),
                func.coalesce(func.sum(Income.amount), 0.0).label("total"),
            )
            .join(Category, Category.id == Income.category_id)
            .filter(
                Income.user_id == uid,
                Income.received_at >= d_from,
                Income.received_at <= d_to,
                Category.type == "income",
            )
            .group_by(Category.name)
            .order_by(func.sum(Income.amount).desc())
            .all()
        )
        income_by_category = [
            {"category": r.category or "Thu nhập", "total": float(r.total or 0)}
            for r in inc_cat_rows
        ]

    # ====== KPI ======
    days = (d_to - d_from).days + 1
    avg_per_day = float(total_expense) / days if days > 0 else 0.0

    # 1) xu hướng chi tiêu = so sánh với tháng trước
    last_month_end = d_from.replace(day=1) - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    prev_expense = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(
            Expense.user_id == uid,
            Expense.spent_at >= last_month_start,
            Expense.spent_at <= last_month_end,
        )
        .scalar()
        or 0.0
    )
    if prev_expense > 0:
        month_trend_pct = (
            (float(total_expense) - float(prev_expense)) / float(prev_expense)
        )
    else:
        month_trend_pct = 0.0

    # 2) hiệu quả ngân sách = đã chi / tổng ngân sách tháng
    bud_total = (
        db.session.query(func.coalesce(func.sum(Budget.limit_amount), 0.0))
        .filter(
            Budget.user_id == uid,
            Budget.period_year == d_from.year,
            Budget.period_month == d_from.month,
        )
        .scalar()
        or 0.0
    )
    budget_efficiency = (
        float(total_expense) / float(bud_total) if bud_total > 0 else 0.0
    )

    # 3) tỷ lệ tiết kiệm = (thu - chi) / thu
    saving_rate = (
        (float(total_income) - float(total_expense)) / float(total_income)
        if total_income > 0
        else 0.0
    )

    kpi = {
        "total_expense": float(total_expense),
        "total_income": float(total_income),
        "avg_per_day": avg_per_day,
        "tx_count": len(all_exp),
        "month_trend_pct": month_trend_pct,
        "budget_efficiency": budget_efficiency,
        "saving_rate": saving_rate,
    }

    return jsonify(
        {
            "from": d_from.isoformat(),
            "to": d_to.isoformat(),
            "range": q_range,
            "kpi": kpi,
            "expense_by_category": expense_by_category,
            "income_by_category": income_by_category,
            "daily_expense": daily_expense,
            "monthly_expense": monthly_expense,
        }
    ), 200



# ========== 5. BUDGET COMPARISON (SỬA THEO MODEL THỰC TẾ) ==========
@bp.get("/budget_comparison")
@jwt_required()
def budget_comparison():
    """
    So sánh chi tiêu thực tế vs ngân sách theo danh mục
    Dựa trên model:
      - budgets: period_year, period_month, limit_amount
      - expenses: spent_at (DATE)
    Trả về: {from, to, items: [{category_id, category, budget, expense}]}
    """
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    today = date.today()
    q_from = request.args.get("from")
    q_to = request.args.get("to")

    if q_from and q_to:
        d_from = _parse_ymd(q_from, today.replace(day=1))
        d_to = _parse_ymd(q_to, today)
    else:
        d_from = today.replace(day=1)
        d_to = today

    # --- chi tiêu thật theo danh mục trong khoảng ngày ---
    exp_sub = (
        db.session.query(
            Expense.category_id.label("category_id"),
            func.coalesce(func.sum(Expense.amount), 0.0).label("expense"),
        )
        .filter(
            Expense.user_id == uid,
            Expense.spent_at >= d_from,
            Expense.spent_at <= d_to,
        )
        .group_by(Expense.category_id)
        .subquery()
    )

    # --- ngân sách của tháng này ---
    # model bạn: limit_amount, period_year, period_month
    bud_sub = (
        db.session.query(
            Budget.category_id.label("category_id"),
            func.coalesce(func.sum(Budget.limit_amount), 0.0).label("budget"),
        )
        .filter(
            Budget.user_id == uid,
            Budget.period_year == d_from.year,
            Budget.period_month == d_from.month,
        )
        .group_by(Budget.category_id)
        .subquery()
    )

    # --- dùng bảng categories để lấy tên, và chỉ lấy loại 'expense' ---
    rows = (
        db.session.query(
            Category.id.label("category_id"),
            Category.name.label("category"),
            func.coalesce(bud_sub.c.budget, 0.0).label("budget"),
            func.coalesce(exp_sub.c.expense, 0.0).label("expense"),
        )
        .filter(
            Category.type == "expense",
            (Category.user_id == uid) | (Category.user_id.is_(None)),
        )
        .outerjoin(bud_sub, bud_sub.c.category_id == Category.id)
        .outerjoin(exp_sub, exp_sub.c.category_id == Category.id)
        .order_by(Category.name.asc())
        .all()
    )

    items = [
        {
            "category_id": r.category_id,
            "category": r.category,
            "budget": float(r.budget or 0),
            "expense": float(r.expense or 0),
        }
        for r in rows
    ]

    return jsonify(
        {
            "from": d_from.isoformat(),
            "to": d_to.isoformat(),
            "items": items,
        }
    )

@bp.get("/savings_progress")
@jwt_required()
def savings_progress():
    """
    Trả danh sách mục tiêu tiết kiệm để trang analytics vẽ chart.
    Frontend đang đọc các trường: id | name | current_amount | target_amount
    nên mình chuẩn hóa về đúng các key đó.
    """
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    # lấy tất cả goal của user
    goals = (
        db.session.query(SavingsGoal)
        .filter(SavingsGoal.user_id == uid)
        .order_by(SavingsGoal.created_at.desc())
        .all()
    )
    if not goals:
        return jsonify({"items": []})

    goal_ids = [g.id for g in goals]

    # tổng tiền đã góp theo từng goal
    hist = (
        db.session.query(
            SavingsHistory.goal_id,
            func.coalesce(func.sum(SavingsHistory.amount), 0.0).label("total"),
        )
        .filter(SavingsHistory.goal_id.in_(goal_ids))
        .group_by(SavingsHistory.goal_id)
        .all()
    )
    hist_map = {h.goal_id: float(h.total or 0) for h in hist}

    items = []
    for g in goals:
        # tên
        name = (
            getattr(g, "name", None)
            or getattr(g, "title", None)
            or f"Mục tiêu #{g.id}"
        )
        # số tiền mục tiêu – tùy model của bạn
        target = (
            getattr(g, "target_amount", None)
            or getattr(g, "goal_amount", None)
            or getattr(g, "amount", None)
            or 0
        )
        # số đã góp: ưu tiên cột hiện có trong goal, nếu không thì lấy từ history
        current = (
            getattr(g, "current_amount", None)
            or getattr(g, "saved_amount", None)
            or hist_map.get(g.id, 0.0)
            or 0.0
        )

        items.append(
            {
                "id": g.id,
                "name": name,
                "target_amount": float(target or 0),
                "current_amount": float(current or 0),
            }
        )

    return jsonify({"items": items})

@bp.route("/forecast/expenses", methods=["GET"])
@jwt_required()
def forecast_expenses():
    user_id = get_jwt_identity()
    result = build_expense_forecast(user_id, periods=30)

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)

@bp.get("/health_score")
@jwt_required()
def analytics_health_score():
    user_id = get_jwt_identity()

    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)

    if not year or not month:
        today = date.today()
        year = today.year
        month = today.month

    data = compute_financial_health(user_id, year, month)
    return jsonify(data), 200
