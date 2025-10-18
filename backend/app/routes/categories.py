# backend/app/routes/categories.py
from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, func
from ..extensions import db
from ..models.category import Category

bp = Blueprint("categories_api", __name__, url_prefix="/api/categories")

ALLOWED_TYPES = {"expense", "income", "saving", "budget"}

def ok(data=None, code=200):
    base = {"success": True}
    if isinstance(data, dict):
        base.update(data)
    return jsonify(base), code

def fail(msg="Bad request", code=400):
    return jsonify({"success": False, "message": msg}), code

@bp.get("")  # không dùng "/" để cả /api/categories và /api/categories/ đều match
def list_categories():
    """
    Trả danh sách categories (id, name).
    Hỗ trợ filter theo ?type=budget|expense|income|saving.
    Nếu có user đăng nhập, trả cả danh mục hệ thống (user_id=NULL) + của user.
    """
    qtype = (request.args.get("type") or "").strip().lower()
    q = Category.query

    if qtype:
        # nếu truyền type nhưng không hợp lệ thì trả rỗng cho an toàn
        if qtype not in ALLOWED_TYPES:
            return ok({"items": []})

        q = q.filter(Category.type == qtype)

    # nếu bạn có g.user thì dùng g.user.id, còn JWT thì lấy từ token
    user_id = getattr(getattr(g, "user", None), "id", None)
    if user_id is None:
        try:
            uid = get_jwt_identity()
            user_id = uid.get("id") if isinstance(uid, dict) else uid
        except Exception:
            user_id = None

    if user_id is not None:
        q = q.filter(or_(Category.user_id == None, Category.user_id == user_id))
    else:
        q = q.filter(Category.user_id == None)

    cats = q.order_by(Category.user_id.isnot(None), Category.name.asc()).all()
    items = [{"id": c.id, "name": c.name} for c in cats]
    return ok({"items": items})

@bp.post("")
@jwt_required()
def create_category():
    """
    Tạo category mới (yêu cầu login).
    Cho phép type: expense|income|saving|budget.
    Mặc định tạo theo scope của user (nếu muốn danh mục hệ thống thì để user_id=None).
    """
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    ctype = (data.get("type") or "expense").strip().lower()

    if not name:
        return fail("name là bắt buộc", 422)
    if ctype not in ALLOWED_TYPES:
        return fail("type phải là 'expense'/'income'/'saving'/'budget'", 422)

    uid = get_jwt_identity()
    user_id = uid.get("id") if isinstance(uid, dict) else uid
    # nếu muốn danh mục hệ thống qua API, cho phép truyền explicit user_id=None:
    if data.get("system") is True:
        user_id = None

    # chống trùng (user_id, name, type)
    exists = Category.query.filter(
        func.lower(Category.name) == name.lower(),
        Category.type == ctype,
        Category.user_id.is_(None) if user_id is None else (Category.user_id == user_id),
    ).first()
    if exists:
        return fail("Category đã tồn tại", 409)

    c = Category(name=name, type=ctype, user_id=user_id)
    db.session.add(c)
    db.session.commit()
    return ok({"category": {"id": c.id, "name": c.name, "type": c.type}}, 201)
