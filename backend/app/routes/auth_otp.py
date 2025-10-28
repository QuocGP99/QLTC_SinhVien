from flask import Blueprint, request, jsonify, url_for, current_app
from ..extensions import db
from ..models.user import User
from ..models.otp import OTPVerification
from ..utils.mailer_otp import send_otp_email
import random

bp = Blueprint("auth_api", __name__, url_prefix="/api/auth")

def generate_code():
    return f"{random.randint(0, 999999):06d}"

@bp.post("/register")
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    full_name = data.get("full_name") or ""
    password = data.get("password") or ""
    if not email or not password:
        return jsonify(success=False, message="Thiếu email hoặc mật khẩu"), 400

    exist = User.query.filter_by(email=email).first()
    if exist:
        return jsonify(success=False, message="Email đã tồn tại"), 400

    user = User(email=email, full_name=full_name, role="user", is_verified=False)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    ttl = current_app.config.get("OTP_TTL_MIN", 10)
    code = generate_code()
    OTPVerification.create_for(email=email, code=code, ttl_min=ttl)
    send_otp_email(email, code, ttl_min=ttl)

    return jsonify(success=True, redirect=url_for("web.otp_verify", _external=False) + f"?email={email}")

@bp.post("/resend-otp")
def resend_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify(success=False, message="Thiếu email"), 400

    ttl = current_app.config.get("OTP_TTL_MIN", 10)
    code = generate_code()
    OTPVerification.create_for(email=email, code=code, ttl_min=ttl)
    send_otp_email(email, code, ttl_min=ttl)
    return jsonify(success=True, message="Đã gửi lại mã OTP")

@bp.post("/verify-otp")
def verify_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    if not email or not code:
        return jsonify(success=False, message="Thiếu email hoặc mã OTP"), 400

    otp = (
        OTPVerification.query
        .filter_by(email=email, code=code, used=False)
        .order_by(OTPVerification.created_at.desc())
        .first()
    )

    if not otp or not otp.is_valid():
        return jsonify(success=False, message="Mã OTP không hợp lệ hoặc đã hết hạn"), 400

    otp.mark_used()
    user = User.query.filter_by(email=email).first()
    if user:
        user.is_verified = True
        db.session.commit()

    return jsonify(success=True, message="Tài khoản của bạn đã được xác thực")
