# backend/app/routes/web.py
from flask import Blueprint, render_template, redirect, url_for
import os

bp = Blueprint("web", __name__)

def _api_base():
    return os.getenv("BASE_API_URL", "")

@bp.route("/")
def index():
    # Trang chủ website – bạn render landing ở base.html hoặc 1 trang riêng
    return render_template(
        "base.html",
        BASE_API_URL=_api_base(),
        title="Trang chủ",
        SKIP_ROLE_GUARD=True,  # tắt guard nếu base.html có guard user
    )

@bp.route("/login")
def login():
    # Login USER
    return render_template(
        "auth/login.html",
        BASE_API_URL=_api_base(),
        GOOGLE_CLIENT_ID=os.getenv("GOOGLE_CLIENT_ID",""),
        title="Đăng nhập"
    )

@bp.route("/register")
def register():
    return render_template(
        "auth/register.html",
        BASE_API_URL=_api_base(),
        GOOGLE_CLIENT_ID=os.getenv("GOOGLE_CLIENT_ID",""),
        title="Đăng ký"
    )

@bp.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", BASE_API_URL=_api_base(), title="Dashboard")

@bp.route("/logout")
def logout():
    return redirect(url_for("web.login"))

# ===== ADMIN =====
@bp.get("/admin")
def admin_login():
    # Trang login ADMIN riêng
    return render_template(
        "admin/login.html",
        BASE_API_URL=_api_base(),
        title="Admin Login"
    )

@bp.get("/admin/dashboard")
def admin_dashboard():
    return render_template("admin/index.html", BASE_API_URL=_api_base(), title="Admin Dashboard")

@bp.get("/admin/users")
def admin_users_page():
    return render_template("admin/users.html", BASE_API_URL=_api_base(), title="Quản trị người dùng")

@bp.route("/expenses")
def expenses():
    return render_template("expenses/list.html", BASE_API_URL=_api_base(), title="Quản lý chi tiêu")

@bp.route("/budgets")
def budgets():
    return render_template("budget/index.html", BASE_API_URL=_api_base(), title="Quản lý ngân sách")

@bp.route("/savings")
def savings():
    return render_template("savings/index.html", BASE_API_URL=_api_base(), title="Mục tiêu tiết kiệm")

@bp.route("/settings")
def settings():
    return render_template("settings.html", BASE_API_URL=_api_base(), title="Cài đặt")

@bp.route("/analytics")
def analytics():
    return render_template("analytics/index.html", BASE_API_URL=_api_base(), title="Phân tích")

@bp.route("/verify-otp/<email>")
def verify_otp(email):
    """Trang xác thực OTP sau khi đăng ký hoặc đăng nhập Google"""
    return render_template(
        "auth/otp_verify.html",  # file template bạn vừa tạo
        BASE_API_URL=_api_base(),
        email=email,              # ← truyền email cho Jinja
        title="Xác thực Email"
    )
