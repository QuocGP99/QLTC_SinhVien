from flask import Blueprint, request, jsonify
from flask_jwt_extended import(create_access_token, create_refresh_token,
                                jwt_required, get_jwt_identity, get_jwt) 
from ..extensions import db, jwt, jwt_blocklist
from ..models.user import User
import re, time
from datetime import timedelta

bp = Blueprint("auth", __name__)

# Helpers
def fail(msg, code = 400):
    return jsonify({"success": False, "message": msg}), code

def ok(data = None, code = 200):
    out = {"success": True}
    if data is not None:
        out.update(data)
    return jsonify(out), code

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$") 

def validate_password(password: str) -> bool:
    # >=6 ký tự, có số và chữ
    if len(password) < 6:
        return False
    if not re.search(r"[A-Za-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    return True

#JWT callbacks
@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return jti in jwt_blocklist

# Routes
@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    full_name = data.get("full_name", "").strip()


    if not email or not EMAIL_REGEX.match(email):
        return fail("Email không hợp lệ", 422)
    if not password or not validate_password(password):
        return fail("Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số", 422)

    if User.query.filter_by(email=email).first():
        return fail("Email đã tồn tại", 409)

    user = User(email=email, full_name=full_name)
    user.set_password(password)
    db.session.add(user); db.session.commit()

    access = create_access_token(identity=str(user.id), additional_claims={"typ": "access"}, expires_delta=timedelta(hours=24))
    refresh = create_refresh_token(identity=str(user.id), additional_claims={"typ": "refresh"}, expires_delta=timedelta(days=7))
    return ok({"user": user.to_public(),
               "access_token": access, "refresh_token": refresh, "token_type": "Bearer"}, 201)
    
@bp.post("/login")
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    remember = data.get("remember")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return fail("Sai email hoặc mật khẩu", 401)

    exp_seconds = 60*60*24 if remember else None #mac dinh config
    access = create_access_token(identity=str(user.id), additional_claims={"typ": "access"}, expires_delta=timedelta(seconds=exp_seconds))
    refresh = create_refresh_token(identity=str(user.id), additional_claims={"typ": "refresh"}, expires_delta=timedelta(days=7))
    return ok({"user": user.to_public(),
               "access_token": access, "refresh_token": refresh, "token_type": "Bearer"})

@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    uid = get_jwt_identity()
    access = create_access_token(identity=uid, additional_claims={"typ": "access"})
    return ok({"access_token": access, "token_type": "Bearer"})

@bp.get("/me")
@jwt_required()
def me():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return fail("User không tồn tại", 404)
    return ok({"user": user.to_public()})

@bp.post("/logout")
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    jwt_blocklist.add(jti)
    return ok({"msg": "Đăng xuất thành công"})

#forgot password
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app

def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="reset-password")


@bp.post("/forgot")
def forgot():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not EMAIL_REGEX.match(email):
        return fail("Email không hợp lệ", 422)
    user = User.query.filter_by(email=email).first()
    if not user:
        # trả success để tránh lộ email tồn tại hay không
        return ok({"message": "Nếu email tồn tại, đường dẫn đặt lại mật khẩu sẽ được gửi."})
    token = _serializer().dumps({"uid": user.id, "ts": int(time.time())})
    # TODO: gửi email kèm link: https://your-fe/reset?token=...
    return ok({"reset_token_dev_only": token})  # DEV: trả token để test ngay


@bp.post("/reset")
def reset_password():
    data = request.get_json() or {}
    token = data.get("token")
    new_pw = data.get("password") or ""
    if not validate_password(new_pw):
        return fail("Mật khẩu tối thiểu 6 ký tự, gồm cả chữ và số", 422)
    try:
        payload = _serializer().loads(token, max_age=3600)  # 1h
    except (BadSignature, SignatureExpired):
        return fail("Token không hợp lệ hoặc đã hết hạn", 400)
    user = User.query.get(payload.get("uid"))
    if not user:
        return fail("User không tồn tại", 404)
    user.set_password(new_pw)
    db.session.commit()
    return ok({"message": "Đặt lại mật khẩu thành công"})

