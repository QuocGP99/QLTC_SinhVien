# backend/app/routes/analytics.py
from datetime import datetime, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, literal
from ..extensions import db
from ..models.expense import Expense
from ..models.income import Income
from ..models.category import Category
from ..models.payment_method import PaymentMethod

bp = Blueprint("analytics_api", __name__, url_prefix="/api/analytics")

# ---------- Helpers ----------
def _parse_ymd(s: str | None, default: date) -> date:
    if not s:
        return default
    return datetime.strptime(s, "%Y-%m-%d").date()

def _uid():
    uid = get_jwt_identity()
    if isinstance(uid, dict):
        uid = uid.get("id")
    return int(uid) if uid is not None else None


# ---------- 1. Chi tiêu ----------
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
        .join(PaymentMethod, PaymentMethod.id == Expense.payment_method_id)
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
    return jsonify(rows), 200


# ---------- 2. Thu nhập ----------
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
    return jsonify(rows), 200


# ---------- 3. Tổng hợp (Thu + Chi) ----------
@bp.get("/transactions")
@jwt_required()
def transactions():
    """Trả cả thu nhập và chi tiêu."""
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    today = date.today()
    d_from = _parse_ymd(request.args.get("from"), today.replace(day=1))
    d_to = _parse_ymd(request.args.get("to"), today)

    # Lấy cả expense & income
    exp_q = (
        db.session.query(
            Expense.spent_at.label("date"),
            Expense.amount.label("amount"),
            Expense.note.label("note"),
            Category.name.label("category_name"),
            PaymentMethod.name.label("method_name"),
            literal("expense").label("kind"),
        )
        .join(Category, Category.id == Expense.category_id)
        .join(PaymentMethod, PaymentMethod.id == Expense.payment_method_id)
        .filter(
            Expense.user_id == uid,
            Expense.spent_at >= d_from,
            Expense.spent_at <= d_to,
        )
    )

    inc_q = (
        db.session.query(
            Income.received_at.label("date"),
            Income.amount.label("amount"),
            Income.note.label("note"),
            Category.name.label("category_name"),
            literal("").label("method_name"),
            literal("income").label("kind"),
        )
        .join(Category, Category.id == Income.category_id)
        .filter(
            Income.user_id == uid,
            Income.received_at >= d_from,
            Income.received_at <= d_to,
        )
    )

    # Gộp 2 query và order theo CỘT date (không dùng chuỗi "date")
    union_subq = exp_q.union_all(inc_q).subquery()
    results = (
        db.session.query(
            union_subq.c.date,
            union_subq.c.amount,
            union_subq.c.note,
            union_subq.c.category_name,
            union_subq.c.method_name,
            union_subq.c.kind,
        )
        .order_by(union_subq.c.date.desc())
        .all()
    )
    rows = [{
        "date": d.isoformat(),
        "desc": n or "",
        "category": c or ("Thu nhập" if k == "income" else "Khác"),
        "method": m or "",
        "amount": float(a or 0),
        "kind": k,
    } for d, a, n, c, m, k in results]

    return jsonify(rows), 200


# ---------- Giữ nguyên summary & ai-insights ----------
@bp.get("/summary")
@jwt_required()
def summary():
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    today = date.today()
    d_from = request.args.get("from")
    d_to = request.args.get("to")
    if d_from and d_to:
        d_from = _parse_ymd(d_from, today.replace(day=1))
        d_to = _parse_ymd(d_to, today)
    else:
        d_from = today.replace(day=1)
        d_to = today

    total_income = (
        db.session.query(func.coalesce(func.sum(Income.amount), 0.0))
        .filter(Income.user_id == uid, Income.received_at >= d_from, Income.received_at <= d_to)
        .scalar() or 0.0
    )
    total_expenses = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == uid, Expense.spent_at >= d_from, Expense.spent_at <= d_to)
        .scalar() or 0.0
    )
    total_savings = max(0.0, total_income - total_expenses)

    return jsonify(
        {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "total_savings": total_savings,
            "range": {"from": d_from.isoformat(), "to": d_to.isoformat()},
        }
    ), 200


@bp.get("/ai-insights")
@jwt_required()
def ai_insights():
    uid = _uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    today = date.today()
    month_start = today.replace(day=1)
    inc = (
        db.session.query(func.coalesce(func.sum(Income.amount), 0.0))
        .filter(Income.user_id == uid, Income.received_at >= month_start, Income.received_at <= today)
        .scalar()
        or 0.0
    )
    exp = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == uid, Expense.spent_at >= month_start, Expense.spent_at <= today)
        .scalar()
        or 0.0
    )
    saving = max(0.0, inc - exp)
    saving_rate = (saving / inc) if inc > 0 else 0.0

    recs = []
    if exp > 0 and inc > 0 and (exp / inc) > 0.6:
        recs.append("Chi tiêu đang vượt 60% thu nhập, cân nhắc cắt giảm 5–10% nhóm 'Ăn uống' và 'Giải trí'.")
    if saving_rate < 0.2 and inc > 0:
        recs.append("Tỷ lệ tiết kiệm dưới 20%. Đặt mục tiêu cố định tiết kiệm 10–15% mỗi tháng.")
    if not recs:
        recs = ["Tiếp tục duy trì mức chi tiêu hiện tại.", "Thiết lập mục tiêu tiết kiệm cụ thể để tăng tỷ lệ."]

    return jsonify(
        {
            "saving_rate": saving_rate,
            "month_total_income": inc,
            "month_total_expenses": exp,
            "recommendations": recs,
        }
    ), 200
