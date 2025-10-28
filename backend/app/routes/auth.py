from flask import Blueprint, request, jsonify, redirect, url_for
from flask_jwt_extended import(create_access_token, create_refresh_token,
                                jwt_required, get_jwt_identity, get_jwt) 
from ..extensions import db, jwt, jwt_blocklist, cache
from ..models.user import User
from ..utils.mailer import send_email
import os
import random
import re, time
import json
from datetime import datetime, timedelta
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from werkzeug.security import generate_password_hash

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

OTP_TTL_SECONDS = 300  # ma co hieu luc 5 phut
OTP_COOLDOWN_SECONDS = 60 #60s moi cho gui lai

def _otp_cache_key(email): return f"otp:{email}"
def _otp_cooldown_key(email): return f"otp_cooldown:{email}"

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
    # cố gắng parse JSON vào dict
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raw = request.get_data(as_text=True).strip()
        try:
            data = json.loads(raw) if raw else {}
        except Exception:
            data = request.form.to_dict()

    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    full_name = (data.get("full_name") or "").strip()

    # validate đầu vào
    if not email or not EMAIL_REGEX.match(email):
        return jsonify(success=False, message="Email không hợp lệ"), 422
    if not password or not validate_password(password):
        return jsonify(success=False, message="Mật khẩu phải >=6 ký tự, gồm chữ và số"), 422

    # nếu email đã tồn tại -> trả JSON lỗi, KHÔNG tạo user nữa
    if User.query.filter_by(email=email).first():
        return jsonify(success=False, message="Email đã tồn tại"), 409

    # tạo user mới với is_verified=False
    user = User(email=email, full_name=full_name)
    user.set_password(password)
    if hasattr(User, "is_verified"):
        user.is_verified = False

    db.session.add(user)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # phòng trường hợp race condition unique email
        return jsonify(success=False, message="Email đã tồn tại"), 409

    # chống spam resend OTP bằng cooldown
    if cache.get(_otp_cooldown_key(email)):
        return jsonify(
            success=False,
            message="Vui lòng chờ 60s trước khi yêu cầu gửi lại mã OTP",
        ), 429

    # sinh mã OTP 6 số
    code = f"{random.randint(0, 999999):06d}"

    # lưu OTP vào cache với TTL
    cache.set(_otp_cache_key(email), code, timeout=OTP_TTL_SECONDS)
    cache.set(_otp_cooldown_key(email), 1, timeout=OTP_COOLDOWN_SECONDS)

    # gửi email OTP
    send_email(
        to=email,
        subject="SVFinance - Mã xác thực OTP",
        template_name="otp",  # sẽ render templates/email/otp.html và otp.txt
        email=email,
        code=code,
        ttl_min=OTP_TTL_SECONDS // 60,
    )

    # trả JSON để FE redirect qua trang nhập OTP
    return jsonify({
        "success": True,
        "message": "Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP xác thực.",
        "redirect_url": f"/verify-otp/{email}",
    }), 201

@bp.post("/resend-otp")
def resend_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email or not EMAIL_REGEX.match(email):
        return fail("Email khong hop le", 422)
    if cache.get(_otp_cooldown_key(email)):
        return fail("Vui lòng chờ 60s trước khi yêu cầu gửi lại mã OTP", 429)

    code = f"{random.randint(0, 999999):06d}"
    cache.set(_otp_cache_key(email), code, timeout=OTP_TTL_SECONDS)
    cache.set(_otp_cooldown_key(email), 1, timeout=OTP_COOLDOWN_SECONDS)
    #print(f"[DEBUG] Resent OTP for {email}: {code}")  # DEV: in OTP ra console
    send_email(
        to=email,
        subject="SVFinance - Mã xác thực OTP (gửi lại)",
        template_name="otp",
        email=email,
        code=code,
        ttl_min=OTP_TTL_SECONDS // 60
    )

    return ok({"message": "Mã OTP đã được gửi lại. Vui lòng kiểm tra email."})

@bp.post("/verify-otp")
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()

    saved = cache.get(_otp_cache_key(email))
    if not saved or saved != code:
        return fail("Mã OTP không đúng hoặc hết hạn", 400)
    
    #OTP hop le -> danh dau verified va cap token
    user = User.query.filter_by(email=email).first()
    if not user:
        return fail("User không tồn tại", 404)
    if hasattr(User, "is_verified"):
        user.is_verified = True
        db.session.commit()

    claims_access = {"typ":"access", "role": getattr(user, "role", "user")}
    claims_refresh = {"typ":"refresh","role": getattr(user, "role", "user")}
    access = create_access_token(
        identity=str(user.id),
        additional_claims=claims_access,
        expires_delta=timedelta(hours=24)
    )          
    refresh = create_refresh_token(
        identity=str(user.id),
        additional_claims=claims_refresh,
        expires_delta=timedelta(days=7)
    )

    # Xoa OTP khoi cache
    cache.delete(_otp_cache_key(email))

    return ok({
        "user": user.to_public(),
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer",
        "message": "Xác thực OTP thành công"})

@bp.post("/login")
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raw = request.get_data(as_text=True).strip()
        try:
            data = json.loads(raw) if raw else {}
        except Exception:
            data = request.form.to_dict()

    mode = (data.get("mode") or "user").strip().lower() 
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    if not email or not password:
        return fail("Email/Mật khẩu là bắt buộc", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return fail("Sai email/ mật khẩu", 401)

    # <<<< NEW: ép role theo mode
    if mode == "user" and user.role != "user":
        return fail("User không tồn tại", 404)
    if mode == "admin" and user.role != "admin":
        return fail("Admin không tồn tại", 404)

    remember = data.get("remember")
    exp_seconds = 60*60*24 if remember else None
    claims_access  = {"typ":"access", "role": user.role}
    claims_refresh = {"typ":"refresh","role": user.role}

    access = create_access_token(
        identity=str(user.id),
        additional_claims=claims_access,
        expires_delta=(timedelta(seconds=exp_seconds) if exp_seconds else None)
    )
    refresh = create_refresh_token(
        identity=str(user.id),
        additional_claims=claims_refresh,
        expires_delta=timedelta(days=7)
    )
    return ok({
        "user": user.to_public(),
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer",
        "message": "Đăng nhập thành công"
    })

@bp.post("/login_form")
def login_form_bridge():
    email = (request.form.get("email") or "").strip().lower()
    password = (request.form.get("password") or "").strip()

    if not email or not password:
        return redirect("/login")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return redirect("/login?err=bad_cred")

    return redirect("/dashboard?login_ok=1")



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
        return fail("Người dùng không tồn tại", 404)
    return ok({"user": user.to_public()})

@bp.post("/logout")
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    jwt_blocklist.add(jti)
    return ok({"msg": "Đăng xuất thành công"})

# ========================
# QUÊN / ĐẶT LẠI MẬT KHẨU
# ========================

@bp.post("/forgot")
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not EMAIL_REGEX.match(email):
        return fail("Email không hợp lệ", 422)

    user = User.query.filter_by(email=email).first()
    if not user:
        # Không tiết lộ email tồn tại hay không
        return ok({"message": "Nếu email tồn tại, bạn sẽ nhận được mã xác nhận trong hộp thư."})

    # chống spam gửi lại
    if cache.get(_otp_cooldown_key(email)):
        return fail("Vui lòng chờ 60s trước khi yêu cầu gửi lại mã xác nhận", 429)

    # Sinh mã OTP 6 số
    code = f"{random.randint(0, 999999):06d}"

    # Lưu OTP reset vào cache
    cache.set(_otp_cache_key(f"reset:{email}"), code, timeout=OTP_TTL_SECONDS)
    cache.set(_otp_cooldown_key(email), 1, timeout=OTP_COOLDOWN_SECONDS)

    # Gửi email xác nhận đặt lại mật khẩu
    send_email(
        to=email,
        subject="SVFinance - Mã xác nhận đặt lại mật khẩu",
        template_name="otp",  # dùng lại otp.html/otp.txt
        email=email,
        code=code,
        ttl_min=OTP_TTL_SECONDS // 60,
    )

    return ok({"message": "Đã gửi mã xác nhận đến email của bạn."})


@bp.post("/reset")
def reset_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    new_pw = (data.get("password") or "").strip()
    confirm_pw = (data.get("confirm_password") or "").strip()

    if not EMAIL_REGEX.match(email):
        return fail("Email không hợp lệ", 422)
    if new_pw != confirm_pw:
        return fail("Mật khẩu xác nhận không khớp", 422)
    if not validate_password(new_pw):
        return fail("Mật khẩu phải >=6 ký tự, gồm chữ và số", 422)

    # Kiểm tra OTP reset
    saved = cache.get(_otp_cache_key(f"reset:{email}"))
    if not saved or saved != code:
        return fail("Mã xác nhận không đúng hoặc đã hết hạn", 400)

    user = User.query.filter_by(email=email).first()
    if not user:
        return fail("Người dùng không tồn tại", 404)

    user.set_password(new_pw)
    db.session.commit()

    # Xóa mã reset khỏi cache
    cache.delete(_otp_cache_key(f"reset:{email}"))

    return ok({"message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."})


@bp.post("/google")
def login_with_google():
    data = request.get_json(silent=True) or {}
    credential = data.get("credential")
    mode = (data.get("mode") or "user").strip().lower()   # <<<< NEW (ngữ cảnh)

    if not credential:
        return fail("Thiếu Google credential", 400)

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    if not GOOGLE_CLIENT_ID:
        return fail("Server chưa cấu hình GOOGLE_CLIENT_ID", 500)

    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        email = (idinfo.get("email") or "").lower()
        if not email:
            return fail("Không lấy được email từ Google", 400)
        if idinfo.get("email_verified") is False:
            return fail("Email Google chưa được xác minh", 401)

        user = User.query.filter_by(email=email).first()
        if not user:
            # tạo mặc định role=user (giữ nguyên phần cũ của bạn)
            full_name = idinfo.get("name") or "Google User"
            user = User(email=email, full_name=full_name)
            user.password_hash = generate_password_hash(os.urandom(12).hex())
            if hasattr(User, "role") and not getattr(user, "role", None):
                user.role = "user"
            db.session.add(user)
            db.session.commit()

        # <<<< NEW: ép role theo mode
        if mode == "user" and user.role != "user":
            return fail("Người dùng không tồn tại", 404)
        if mode == "admin" and user.role != "admin":
            return fail("Admin không tồn tại", 404)

        claims = {"typ": "access", "role": user.role}
        access = create_access_token(identity=str(user.id), additional_claims=claims, expires_delta=timedelta(hours=24))
        refresh = create_refresh_token(identity=str(user.id), additional_claims={"typ":"refresh","role": user.role}, expires_delta=timedelta(days=7))

        return ok({
            "user": user.to_public(),
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "Bearer"
        })
    except ValueError:
        return fail("Google token không hợp lệ", 401)
    except Exception as e:
        return fail(f"Lỗi xác thực Google: {str(e)}", 500)
    
# backend/app/routes/auth.py (chỉ thêm đoạn dưới; các route cũ giữ nguyên)

@bp.post("/login_admin")
def login_admin():
    """
    Đăng nhập ADMIN độc lập với login user.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raw = request.get_data(as_text=True).strip()
        try:
            data = json.loads(raw) if raw else {}
        except Exception:
            data = request.form.to_dict()

    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    if not email or not password:
        return fail("Email/password required", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        # Giữ thông điệp mơ hồ tránh lộ thông tin
        return fail("Sai email hoặc mật khẩu", 401)

    # Ép phải là admin
    if getattr(user, "role", "user") != "admin":
        return fail("Admin khong ton tai", 404)

    claims_access  = {"typ": "access", "role": "admin"}
    claims_refresh = {"typ": "refresh", "role": "admin"}

    access = create_access_token(identity=str(user.id), additional_claims=claims_access, expires_delta=timedelta(hours=24))
    refresh = create_refresh_token(identity=str(user.id), additional_claims=claims_refresh, expires_delta=timedelta(days=7))

    return ok({
        "user": user.to_public(),
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer"
    })

