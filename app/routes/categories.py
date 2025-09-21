from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.category import Category

bp = Blueprint("categories", __name__)

@bp.get("")
def list_categories():
    """Trả toàn bộ categories, sort theo tên"""
    cats = Category.query.order_by(Category.name.asc()).all()
    items = [{"id": c.id, "name": c.name, "type": c.type} for c in cats]
    return jsonify(items), 200

@bp.post("")
@jwt_required()
def create_category():
    """Tạo category mới (yêu cầu login)"""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    ctype = (data.get("type") or "expense").strip().lower()

    # validate cơ bản
    if not name:
        return jsonify({"error": "name là bắt buộc"}), 422
    if ctype not in ("expense", "income"):
        return jsonify({"error": "type phải là 'expense' hoặc 'income'"}), 422

    # chống trùng tên (theo type)
    exists = Category.query.filter(
        db.func.lower(Category.name) == name.lower(),
        Category.type == ctype
    ).first()
    if exists:
        return jsonify({"error": "Category đã tồn tại"}), 409

    c = Category(name=name, type=ctype)
    db.session.add(c)
    db.session.commit()

    return jsonify({"id": c.id, "name": c.name, "type": c.type}), 201