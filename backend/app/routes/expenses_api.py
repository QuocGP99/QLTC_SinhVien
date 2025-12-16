# backend/app/routes/expenses_api.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.expense import Expense
from ..models.category import Category
from ..models.payment_method import PaymentMethod
from ..models.money_source import MoneySource
from ..services.money_source_service import MoneySourceService
from datetime import date, datetime
from decimal import Decimal
from ..ai.classifier import predict_category_all

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


def _auto_money_source_id(user_id, payment_method_id, explicit_money_source_id=None):
    """
    Auto-map payment method to money source.
    If explicit_money_source_id is provided, use it.
    Otherwise, find money source with same name as payment_method.
    """
    if explicit_money_source_id:
        return explicit_money_source_id
    
    if not payment_method_id:
        return None
    
    # Get payment method name
    pm = PaymentMethod.query.get(payment_method_id)
    if not pm:
        return None
    
    # Find money source with matching name for this user
    source = MoneySource.query.filter_by(
        user_id=user_id,
        name=pm.name,
        is_active=True
    ).first()
    
    return source.id if source else None


def _exp_to_dict(x: Expense):
    return {
        "id": x.id,
        "user_id": x.user_id,
        "category": x.category.name if x.category else None,
        "category_id": x.category_id,
        "method": x.payment_method.name if x.payment_method else None,
        "payment_method_id": x.payment_method_id,
        "money_source_id": x.money_source_id,
        "amount": int(Decimal(x.amount)),  # front đang dùng VND không lẻ
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
    d_to = _parse_date(request.args.get("to"))
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

    return (
        jsonify(
            {
                "success": True,
                "items": items,
                "kpi": {"total": total, "count": count, "avg": avg},
            }
        ),
        200,
    )


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
    money_source_id = data.get("money_source_id")
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

    # Auto-map payment_method to money_source if not provided
    if not money_source_id and pm_id:
        money_source_id = _auto_money_source_id(user_id, pm_id, None)

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
        return (
            jsonify(
                {
                    "success": False,
                    "message": "Thiếu dữ liệu hoặc danh mục không hợp lệ",
                }
            ),
            400,
        )
    if cat.type != "expense":
        return (
            jsonify(
                {"success": False, "message": "Danh mục phải thuộc loại 'expense'"}
            ),
            400,
        )

    spent_at = _parse_date(date_str) or date.today()

    pm_id = None
    if method_name:
        pm = PaymentMethod.query.filter_by(name=method_name).first()
        pm_id = pm.id if pm else None

    e = Expense(
        user_id=user_id,
        category_id=cat.id,
        payment_method_id=pm_id,
        money_source_id=money_source_id,
        amount=Decimal(amount),
        spent_at=spent_at,
        note=desc,
    )
    db.session.add(e)
    db.session.commit()

    # Sync to money source: deduct amount
    if money_source_id:
        MoneySourceService.sync_expense_to_source(money_source_id, user_id, 0, amount)

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
    old_amount = float(e.amount) if e.amount else 0
    old_money_source_id = e.money_source_id

    if "desc" in data:
        e.note = (data["desc"] or "").strip()
    elif "description" in data:
        e.note = (data["description"] or "").strip()

    if "payment_method_id" in data:
        val = data["payment_method_id"]
        if val:
            pm = PaymentMethod.query.get(int(val))
            e.payment_method_id = pm.id if pm else None
            # Auto-map to money source when payment method changes
            if not ("money_source_id" in data):
                money_source_id = _auto_money_source_id(user_id, e.payment_method_id, None)
                if money_source_id:
                    e.money_source_id = money_source_id
        else:
            e.payment_method_id = None
    elif "method" in data:
        name = (data["method"] or "").strip() or None
        if name:
            pm = PaymentMethod.query.filter_by(name=name).first()
            e.payment_method_id = pm.id if pm else None
            # Auto-map to money source when payment method changes
            if not ("money_source_id" in data):
                money_source_id = _auto_money_source_id(user_id, e.payment_method_id, None)
                if money_source_id:
                    e.money_source_id = money_source_id
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

    # Handle money_source_id change
    if "money_source_id" in data:
        e.money_source_id = data.get("money_source_id")

    db.session.commit()
    
    # Sync money source if amount or source changed
    new_amount = float(e.amount) if e.amount else 0
    if old_money_source_id and (old_amount != new_amount or old_money_source_id != e.money_source_id):
        MoneySourceService.sync_expense_to_source(
            old_money_source_id, user_id, old_amount, 0  # Remove old deduction
        )
    if e.money_source_id:
        MoneySourceService.sync_expense_to_source(
            e.money_source_id, user_id, 0, new_amount  # Add new deduction
        )
    
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

    # Capture before deleting
    amount = float(e.amount) if e.amount else 0
    money_source_id = e.money_source_id

    db.session.delete(e)
    db.session.commit()
    
    # Sync money source: reverse deduction
    if money_source_id:
        MoneySourceService.sync_expense_to_source(
            money_source_id, user_id, amount, 0  # Remove deduction
        )
    
    return jsonify({"success": True}), 200


# ===== danh mục & phương thức để fill dropdown =====
@bp.get("/meta")
@jwt_required()
def get_meta():
    """
    Trả về categories loại 'expense' để FE dùng CHUNG cho Chi tiêu & Ngân sách.
    Trả theo định dạng [{id, name}] thay vì chỉ name.
    """
    cats = Category.query.filter_by(type="expense").order_by(Category.name).all()
    methods = PaymentMethod.query.order_by(PaymentMethod.name).all()
    return (
        jsonify(
            {
                "success": True,
                "categories": [{"id": c.id, "name": c.name} for c in cats],
                "methods": [{"id": m.id, "name": m.name} for m in methods],
            }
        ),
        200,
    )


@bp.post("/predict_category")
@jwt_required()
def predict_category():
    data = request.get_json()
    text = data.get("text", "")

    preds = predict_category_all(text)

    # khớp danh mục qua database
    enriched = []
    for item in preds:
        cat = Category.query.filter_by(name=item["label"]).first()
        enriched.append(
            {
                "label": item["label"],
                "prob": item["prob"],
                "category_id": cat.id if cat else None,
            }
        )

    return jsonify({"success": True, "predictions": enriched})


@bp.post("/ai_feedback")
@jwt_required()
def ai_feedback():
    from ..models.ai_feedback import AIFeedback

    data = request.get_json()
    desc = data.get("description", "").strip()
    chosen_category = data.get("chosen_category_id")
    import json

    predictions_raw = data.get("predictions", [])

    # Nếu predictions bị gửi lên dạng chuỗi → convert lại thành JSON
    if isinstance(predictions_raw, str):
        predictions = json.loads(predictions_raw)
    else:
        predictions = predictions_raw

    user_id = get_jwt_identity()

    if not desc or not chosen_category:
        return jsonify({"success": False, "msg": "missing fields"}), 400

    fb = AIFeedback(
        user_id=user_id,
        description=desc,
        chosen_category_id=chosen_category,
        ai_predictions=predictions,
    )

    db.session.add(fb)
    db.session.commit()

    return jsonify({"success": True})
