# backend/app/routes/incomes_api.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date
from ..extensions import db
from ..models.income import Income
from ..models.category import Category


bp = Blueprint("incomes_api", __name__, url_prefix="/api/incomes")


# === Helper ===
def current_user_id():
    """Lấy user_id từ JWT"""
    uid = get_jwt_identity()
    if isinstance(uid, dict):
        uid = uid.get("id")
    try:
        return int(uid) if uid is not None else None
    except Exception:
        return uid


def income_to_dict(m: Income):
    """Chuyển model Income sang dict để trả JSON"""
    return {
        "id": m.id,
        "type": "income",
        "category_id": m.category_id,
        "category": getattr(m.category, "name", None),
        "amount": float(m.amount or 0),
        "received_at": m.received_at.isoformat() if m.received_at else None,
        "note": m.note or "",
    }


# === Routes ===

@bp.get("/meta")
@jwt_required()
def get_meta():
    """
    Trả danh mục thu nhập (type='income')
    FE dùng để đổ dropdown khi chọn 'Thu nhập'
    """
    cats = Category.query.filter_by(type="income").order_by(Category.name).all()
    return jsonify({
        "success": True,
        "categories": [{"id": c.id, "name": c.name} for c in cats],
        "methods": []  # thu nhập không có phương thức thanh toán
    }), 200


@bp.get("")
@jwt_required()
def list_incomes():
    """
    Lấy toàn bộ danh sách thu nhập của user hiện tại
    """
    user_id = current_user_id()
    items = (
        Income.query.filter_by(user_id=user_id)
        .order_by(Income.received_at.desc().nullslast(), Income.id.desc())
        .all()
    )
    return jsonify({
        "success": True,
        "items": [income_to_dict(i) for i in items]
    }), 200


@bp.post("")
@jwt_required()
def create_income():
    """
    Thêm thu nhập mới
    Body JSON:
    {
      "amount": 5000000,
      "category_id": 1,
      "date": "2025-10-21",
      "note": "Lương tháng 10"
    }
    """
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    try:
        amount = float(data.get("amount") or 0)
    except Exception:
        return jsonify({"success": False, "message": "amount phải là số"}), 400

    category_id = data.get("category_id")
    date_str = data.get("date") or data.get("received_at")
    note = (data.get("note") or "").strip()

    if amount <= 0:
        return jsonify({"success": False, "message": "Số tiền phải > 0"}), 400
    if not category_id:
        return jsonify({"success": False, "message": "Thiếu danh mục"}), 400

    received = None
    if date_str:
        try:
            received = date.fromisoformat(date_str)
        except Exception:
            return jsonify({
                "success": False,
                "message": "Ngày không hợp lệ (định dạng yyyy-mm-dd)"
            }), 400

    model = Income(
        user_id=user_id,
        category_id=category_id,
        amount=amount,
        received_at=received,
        note=note,
    )
    db.session.add(model)
    db.session.commit()

    return jsonify({
        "success": True,
        "item": income_to_dict(model)
    }), 201


@bp.delete("/<int:income_id>")
@jwt_required()
def delete_income(income_id):
    """
    Xoá 1 thu nhập
    """
    user_id = current_user_id()
    item = Income.query.filter_by(id=income_id, user_id=user_id).first()
    if not item:
        return jsonify({"success": False, "message": "Không tìm thấy thu nhập"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True, "message": "Đã xoá"}), 200


@bp.patch("/<int:income_id>")
@jwt_required()
def update_income(income_id):
    """
    Cập nhật thu nhập
    """
    user_id = current_user_id()
    item = Income.query.filter_by(id=income_id, user_id=user_id).first()
    if not item:
        return jsonify({"success": False, "message": "Không tìm thấy thu nhập"}), 404

    data = request.get_json(silent=True) or {}
    if "amount" in data:
        try:
            item.amount = float(data["amount"])
        except Exception:
            return jsonify({"success": False, "message": "amount phải là số"}), 400

    if "category_id" in data:
        item.category_id = data["category_id"]
    if "note" in data:
        item.note = (data["note"] or "").strip()

    date_str = data.get("date") or data.get("received_at")
    if date_str:
        try:
            item.received_at = date.fromisoformat(date_str)
        except Exception:
            pass

    db.session.commit()
    return jsonify({"success": True, "item": income_to_dict(item)}), 200
