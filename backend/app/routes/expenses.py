# backend/app/routes/expenses_api.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.expense import Expense
from ..models.category import Category
from ..models.payment_method import PaymentMethod
from datetime import date, datetime
from decimal import Decimal

bp = Blueprint("expenses_api", __name__, url_prefix="/api/expenses")

def _int_identity():
    uid_raw = get_jwt_identity()
    try:
        return int(uid_raw)
    except (TypeError, ValueError):
        return None

def _parse_date(s: str | None):
    if not s:
        return None
    return datetime.strptime(s, "%Y-%m-%d").date()

def _exp_to_dict(x: Expense):
    return {
        "id": x.id,
        "user_id": x.user_id,
        "category": x.category.name if x.category else None,
        "category_id": x.category_id,
        "method": x.payment_method.name if x.payment_method else None,
        "payment_method_id": x.payment_method_id,
        "amount": int(Decimal(x.amount)),   # front đang dùng VND không lẻ
        "date": x.spent_at.strftime("%Y-%m-%d"),
        "desc": x.note or "",
    }

@bp.get("")
@jwt_required()
def list_expenses():
    user_id = _int_identity()
    if not user_id:
        return jsonify({"success": False, "message": "Invalid token"}), 401

    q = Expense.query.filter_by(user_id=user_id)

    # filter ?category= & from=YYYY-MM-DD & to=YYYY-MM-DD
    category = request.args.get("category") or ""
    if category:
        q = q.join(Category).filter(Category.name == category)

    d_from = _parse_date(request.args.get("from"))
    d_to   = _parse_date(request.args.get("to"))
    if d_from:
        q = q.filter(Expense.spent_at >= d_from)
    if d_to:
        q = q.filter(Expense.spent_at <= d_to)

    q = q.order_by(Expense.spent_at.desc(), Expense.id.desc())
    items = [_exp_to_dict(x) for x in q.all()]

    # KPI nhanh
    total = sum(x["amount"] for x in items)
    count = len(items)
    avg = int(total / count) if count else 0

    return jsonify({"success": True, "items": items, "kpi": {"total": total, "count": count, "avg": avg}}), 200

@bp.post("")
@jwt_required()
def create_expense():
    user_id = _int_identity()
    if not user_id:
        return jsonify({"success": False, "message": "Invalid token"}), 401

    data = request.get_json(force=True) or {}
    desc = (data.get("desc") or "").strip()
    amount = int(data.get("amount") or 0)
    date_str = data.get("date") or date.today().strftime("%Y-%m-%d")
    category_name = (data.get("category") or "").strip()
    method_name = (data.get("method") or "").strip() or None

    if not desc or amount <= 0 or not category_name:
        return jsonify({"success": False, "message": "Thiếu dữ liệu bắt buộc"}), 400

    spent_at = _parse_date(date_str) or date.today()

    # map tên -> id
    cat = Category.query.filter_by(name=category_name).first()
    if not cat:
        return jsonify({"success": False, "message": "Danh mục không tồn tại"}), 400

    pm_id = None
    if method_name:
        pm = PaymentMethod.query.filter_by(name=method_name).first()
        pm_id = pm.id if pm else None

    e = Expense(
        user_id=user_id,
        category_id=cat.id,
        payment_method_id=pm_id,
        amount=Decimal(amount),
        spent_at=spent_at,
        note=desc,
    )
    db.session.add(e)
    db.session.commit()
    return jsonify({"success": True, "item": _exp_to_dict(e)}), 201

@bp.patch("/<int:expense_id>")
@jwt_required()
def update_expense(expense_id: int):
    user_id = _int_identity()
    if not user_id:
        return jsonify({"success": False, "message": "Invalid token"}), 401

    e = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not e:
        return jsonify({"success": False, "message": "Không tìm thấy giao dịch"}), 404

    data = request.get_json(force=True) or {}

    if "desc" in data:
        e.note = (data["desc"] or "").strip()
    if "amount" in data:
        amt = int(data["amount"] or 0)
        if amt <= 0:
            return jsonify({"success": False, "message": "Số tiền phải > 0"}), 400
        e.amount = Decimal(amt)
    if "date" in data and data["date"]:
        e.spent_at = _parse_date(data["date"]) or e.spent_at
    if "category" in data and data["category"]:
        cat = Category.query.filter_by(name=data["category"]).first()
        if not cat:
            return jsonify({"success": False, "message": "Danh mục không tồn tại"}), 400
        e.category_id = cat.id
    if "method" in data:
        name = (data["method"] or "").strip() or None
        if name:
            pm = PaymentMethod.query.filter_by(name=name).first()
            e.payment_method_id = pm.id if pm else None
        else:
            e.payment_method_id = None

    db.session.commit()
    return jsonify({"success": True, "item": _exp_to_dict(e)}), 200

@bp.delete("/<int:expense_id>")
@jwt_required()
def delete_expense(expense_id: int):
    user_id = _int_identity()
    if not user_id:
        return jsonify({"success": False, "message": "Invalid token"}), 401

    e = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not e:
        return jsonify({"success": False, "message": "Không tìm thấy giao dịch"}), 404

    db.session.delete(e)
    db.session.commit()
    return jsonify({"success": True}), 200


# ===== danh mục & phương thức để fill dropdown =====
@bp.get("/meta")
@jwt_required()
def get_meta():
    cats = [c.name for c in Category.query.order_by(Category.name).all()]
    methods = [m.name for m in PaymentMethod.query.order_by(PaymentMethod.name).all()]
    return jsonify({"success": True, "categories": cats, "methods": methods}), 200
