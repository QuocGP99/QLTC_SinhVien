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

    # filter ?category= (name) hoặc ?category_id= & from=YYYY-MM-DD & to=YYYY-MM-DD
    category_name = (request.args.get("category") or "").strip()
    if category_name:
        q = q.join(Category).filter(Category.name == category_name)

    category_id = request.args.get("category_id")
    if category_id:
        try:
            q = q.filter(Expense.category_id == int(category_id))
        except Exception:
            pass

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
    """
    Ưu tiên nhận category_id (danh mục loại 'expense').
    Vẫn giữ fallback theo tên 'category' để tương thích FE cũ.
    """
    user_id = _int_identity()
    if not user_id:
        return jsonify({"success": False, "message": "Invalid token"}), 401

    data = request.get_json(force=True) or {}
    desc = (data.get("desc") or data.get("description") or "").strip()
    amount = int(data.get("amount") or 0)
    date_str = data.get("date") or date.today().strftime("%Y-%m-%d")
    method_name = (data.get("method") or "").strip() or None
    pm_id = None

    if data.get("payment_method_id"):
        try:
            pm_obj = PaymentMethod.query.get(int(data["payment_method_id"]))
            pm_id = pm_obj.id if pm_obj else None
        except Exception:
            pm_id = None
    elif method_name:
        pm = PaymentMethod.query.filter_by(name=method_name).first()
        pm_id = pm.id if pm else None

    # --- map danh mục ---
    cat = None
    if "category_id" in data and data["category_id"]:
        try:
            cat = Category.query.get(int(data["category_id"]))
        except Exception:
            cat = None
    if cat is None:
        # fallback theo tên (nếu FE cũ vẫn gửi "category")
        category_name = (data.get("category") or "").strip()
        if category_name:
            cat = Category.query.filter_by(name=category_name, type="expense").first()

    if not desc or amount <= 0 or not cat:
        return jsonify({"success": False, "message": "Thiếu dữ liệu hoặc danh mục không hợp lệ"}), 400
    if cat.type != "expense":
        return jsonify({"success": False, "message": "Danh mục phải thuộc loại 'expense'"}), 400

    spent_at = _parse_date(date_str) or date.today()

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
    """
    Cho phép cập nhật category_id (ưu tiên), hoặc fallback theo tên (type='expense').
    """
    user_id = _int_identity()
    if not user_id:
        return jsonify({"success": False, "message": "Invalid token"}), 401

    e = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not e:
        return jsonify({"success": False, "message": "Không tìm thấy giao dịch"}), 404

    data = request.get_json(force=True) or {}

    if "desc" in data:
        e.note = (data["desc"] or "").strip()
    elif "description" in data:
        e.note = (data["description"] or "").strip()

    if "payment_method_id" in data:
        val = data["payment_method_id"]
        if val:
            pm = PaymentMethod.query.get(int(val))
            e.payment_method_id = pm.id if pm else None
        else:
            e.payment_method_id = None
    elif "method" in data:
        name = (data["method"] or "").strip() or None
        if name:
            pm = PaymentMethod.query.filter_by(name=name).first()
            e.payment_method_id = pm.id if pm else None
        else:
            e.payment_method_id = None
            
    if "amount" in data:
        amt = int(data["amount"] or 0)
        if amt <= 0:
            return jsonify({"success": False, "message": "Số tiền phải > 0"}), 400
        e.amount = Decimal(amt)
    if "date" in data and data["date"]:
        e.spent_at = _parse_date(data["date"]) or e.spent_at

    if "category_id" in data and data["category_id"]:
        c = Category.query.get(int(data["category_id"]))
        if not c or c.type != "expense":
            return jsonify({"success": False, "message": "Danh mục không hợp lệ"}), 400
        e.category_id = c.id
    elif "category" in data and data["category"]:
        c = Category.query.filter_by(name=data["category"], type="expense").first()
        if not c:
            return jsonify({"success": False, "message": "Danh mục không tồn tại"}), 400
        e.category_id = c.id

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
    """
    Trả về categories loại 'expense' để FE dùng CHUNG cho Chi tiêu & Ngân sách.
    Trả theo định dạng [{id, name}] thay vì chỉ name.
    """
    cats = (Category.query
            .filter_by(type="expense")
            .order_by(Category.name)
            .all())
    methods = (PaymentMethod.query
               .order_by(PaymentMethod.name)
               .all())
    return jsonify({
        "success": True,
        "categories": [{"id": c.id, "name": c.name} for c in cats],
        "methods": [{"id": m.id, "name": m.name} for m in methods],
    }), 200
