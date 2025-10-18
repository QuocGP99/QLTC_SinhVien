# backend/app/routes/admin_users.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import or_, func
from werkzeug.security import generate_password_hash
from ..extensions import db
from ..models.user import User

bp = Blueprint("admin_users_api", __name__, url_prefix="/api/admin/users")

# ----- Helpers chung -----
def ok(data=None, code=200):
    payload = {"success": True}
    if isinstance(data, dict):
        payload.update(data)
    return jsonify(payload), code

def fail(msg="Bad request", code=400):
    return jsonify({"success": False, "message": msg}), code

def _current_uid():
    """
    get_jwt_identity() có thể là int hoặc dict tùy code login của bạn.
    """
    uid = get_jwt_identity()
    if isinstance(uid, dict):
        uid = uid.get("id")
    try:
        return int(uid) if uid is not None else None
    except Exception:
        return uid

def _require_admin():
    """
    Yêu cầu role=admin. 
    - Nếu bạn đã nhét 'role' vào JWT (additional_claims), lấy nhanh từ get_jwt().
    - Nếu chưa, fallback query DB.
    """
    claims = get_jwt() or {}
    role = claims.get("role")
    if not role:
        uid = _current_uid()
        u = User.query.get(uid) if uid else None
        role = getattr(u, "role", None)
    if role != "admin":
        return False
    return True

def _user_to_dict(u: User):
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role or "user",
        "created_at": u.created_at.isoformat() if getattr(u, "created_at", None) else None,
    }

# ----- API -----

@bp.get("")
@jwt_required()
def list_users():
    if not _require_admin():
        return fail("Bạn không có quyền admin.", 403)

    # Query params: search, page, page_size
    q = request.args.get("search", "", type=str).strip()
    page = max(1, request.args.get("page", 1, type=int))
    page_size = min(100, max(1, request.args.get("page_size", 10, type=int)))

    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(or_(User.email.ilike(like), User.full_name.ilike(like)))

    total = query.with_entities(func.count(User.id)).scalar() or 0
    items = (
        query.order_by(User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ok({
        "items": [_user_to_dict(u) for u in items],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@bp.post("")
@jwt_required()
def create_user():
    if not _require_admin():
        return fail("Bạn không có quyền admin.", 403)

    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    full_name = (data.get("full_name") or "").strip()
    role = (data.get("role") or "user").strip()
    password = data.get("password") or ""

    if not email:
        return fail("Email là bắt buộc.")
    if len(password) < 6:
        return fail("Mật khẩu tối thiểu 6 ký tự.")
    if role not in ("user", "admin"):
        return fail("Role không hợp lệ.")

    # check unique
    if User.query.filter_by(email=email).first():
        return fail("Email đã tồn tại.", 409)

    u = User(
        email=email,
        full_name=full_name,
        role=role
    )
    # Set password
    if hasattr(u, "set_password") and callable(u.set_password):
        u.set_password(password)
    else:
        # fallback nếu model chưa có method
        u.password_hash = generate_password_hash(password)

    db.session.add(u)
    db.session.commit()
    return ok({"item": _user_to_dict(u)}, 201)


@bp.patch("/<int:user_id>")
@jwt_required()
def update_user(user_id: int):
    if not _require_admin():
        return fail("Bạn không có quyền admin.", 403)

    data = request.get_json(force=True) or {}
    full_name = data.get("full_name", None)
    role = data.get("role", None)

    u = User.query.get(user_id)
    if not u:
        return fail("Không tìm thấy người dùng.", 404)

    if full_name is not None:
        u.full_name = (full_name or "").strip()

    if role is not None:
        if role not in ("user", "admin"):
            return fail("Role không hợp lệ.")
        u.role = role

    db.session.commit()
    return ok({"item": _user_to_dict(u)})


@bp.delete("/<int:user_id>")
@jwt_required()
def delete_user(user_id: int):
    if not _require_admin():
        return fail("Bạn không có quyền admin.", 403)

    uid = _current_uid()
    if uid == user_id:
        return fail("Không thể tự xoá chính mình.", 400)

    u = User.query.get(user_id)
    if not u:
        return fail("Không tìm thấy người dùng.", 404)

    db.session.delete(u)
    db.session.commit()
    return ok({"deleted_id": user_id})


@bp.post("/<int:user_id>/reset_password")
@jwt_required()
def reset_password(user_id: int):
    if not _require_admin():
        return fail("Bạn không có quyền admin.", 403)

    data = request.get_json(force=True) or {}
    new_pw = data.get("password") or ""
    if len(new_pw) < 6:
        return fail("Mật khẩu tối thiểu 6 ký tự.")

    u = User.query.get(user_id)
    if not u:
        return fail("Không tìm thấy người dùng.", 404)

    if hasattr(u, "set_password") and callable(u.set_password):
        u.set_password(new_pw)
    else:
        u.password_hash = generate_password_hash(new_pw)

    db.session.commit()
    return ok({"item": _user_to_dict(u)})
