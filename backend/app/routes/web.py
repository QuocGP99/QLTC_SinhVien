from flask import Blueprint, render_template, redirect, url_for, request, session, flash
import os
from ..models.user import User

bp = Blueprint("web", __name__)

FEATURE_FLAG_DEFAULTS = [
    f.strip() for f in os.getenv("FEATURE_FLAGS", "ai, charts").split(",") if f.strip()
]


def _api_base():
    return os.getenv("BASE_API_URL", "")


@bp.route("/")
def index():
    # Trang landing / homepage (khách cũng vào được)
    return render_template(
        "homepage.html",
        BASE_API_URL=_api_base(),
        title="Trang chủ",
        hide_sidebar=True,
        SKIP_ROLE_GUARD=True,  # tắt guard user cho trang public
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/login", methods=["GET", "POST"])
def login():
    # GET -> hiển thị form đăng nhập
    if request.method == "GET":
        return render_template(
            "auth/login.html",
            BASE_API_URL=_api_base(),
            GOOGLE_CLIENT_ID=os.getenv("GOOGLE_CLIENT_ID", ""),
            title="Đăng nhập",
            ADMIN_MODE=False,
            SKIP_ROLE_GUARD=True,
            FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
            ALLOW_AUTH_JS=False,
        )


@bp.route("/logout")
def logout():
    # Xóa user khỏi session
    session.pop("user", None)
    flash("Đăng xuất thành công", "success")
    return redirect(url_for("web.login"))


@bp.route("/dashboard")
def dashboard():
    # Khu người dùng sau đăng nhập
    return render_template(
        "dashboard.html",
        BASE_API_URL=_api_base(),
        title="Dashboard",
        hide_sidebar=False,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/register")
def register():
    return render_template(
        "auth/register.html",
        BASE_API_URL=_api_base(),
        GOOGLE_CLIENT_ID=os.getenv("GOOGLE_CLIENT_ID", ""),
        title="Đăng ký",
        SKIP_ROLE_GUARD=True,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
        # Ở trang register bạn VẪN có thể để ALLOW_AUTH_JS=True (mặc định) để dùng AJAX đăng ký
        # nên mình không truyền ALLOW_AUTH_JS ở đây -> dùng default True trong base_auth.html
    )


@bp.get("/forgot")
def forgot_page():
    return render_template(
        "auth/forgot.html",
        BASE_API_URL=_api_base(),
        title="Quên mật khẩu",
        SKIP_ROLE_GUARD=True,
        hide_sidebar=True,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
        ALLOW_AUTH_JS=False,  # trang này dùng inline script riêng, không cần auth.js
    )


@bp.get("/reset")
def reset_page():
    return render_template(
        "auth/reset.html",
        BASE_API_URL=_api_base(),
        title="Đặt lại mật khẩu",
        SKIP_ROLE_GUARD=True,
        hide_sidebar=True,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
        ALLOW_AUTH_JS=False,  # dùng inline script riêng
    )


# ===== ADMIN ZONE =====
@bp.get("/admin")
def admin_login():
    # Trang login admin (có thể khác, mình vẫn cho phép load auth.js nếu bạn dùng cơ chế API riêng)
    return render_template(
        "admin/login.html",
        BASE_API_URL=_api_base(),
        title="Admin Login",
        SKIP_ROLE_GUARD=True,
        hide_sidebar=True,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
        ALLOW_AUTH_JS=True,  # admin login có thể vẫn dùng flow API của bạn
    )


@bp.get("/admin/dashboard")
def admin_dashboard():
    return render_template(
        "admin/index.html",
        BASE_API_URL=_api_base(),
        title="Admin Dashboard",
        SKIP_ROLE_GUARD=True,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.get("/admin/users")
def admin_users_page():
    return render_template(
        "admin/users.html",
        BASE_API_URL=_api_base(),
        title="Quản trị người dùng",
        SKIP_ROLE_GUARD=True,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/transactions")
def transactions():
    return render_template(
        "transactions/index.html",
        BASE_API_URL=_api_base(),
        title="Quản lý giao dịch",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/transactions/expenses")
def page_expenses():
    return render_template(
        "transactions/expenses.html",
        BASE_API_URL=_api_base(),
        title="Chi tiêu",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/transactions/income")
def page_incomes():
    return render_template(
        "transactions/income.html",
        BASE_API_URL=_api_base(),
        title="Thu nhập",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/budgets")
def budgets():
    return render_template(
        "budget/index.html",
        BASE_API_URL=_api_base(),
        title="Quản lý ngân sách",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/savings")
def savings():
    return render_template(
        "savings/index.html",
        BASE_API_URL=_api_base(),
        title="Mục tiêu tiết kiệm",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/subscriptions")
def subscriptions():
    return render_template(
        "subscriptions/index.html",
        BASE_API_URL=_api_base(),
        title="Quản lý Subscription",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/money-sources")
def money_sources():
    return render_template(
        "money_sources/index.html",
        BASE_API_URL=_api_base(),
        title="Quản lý Nguồn Tiền",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/settings")
def settings():
    return render_template(
        "settings.html",
        BASE_API_URL=_api_base(),
        title="Cài đặt",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/analytics")
def analytics():
    return render_template(
        "analytics/index.html",
        BASE_API_URL=_api_base(),
        title="Phân tích",
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
    )


@bp.route("/verify-otp/<email>")
def verify_otp(email):
    # Trang xác thực OTP (auth layout, không sidebar)
    return render_template(
        "auth/otp_verify.html",
        BASE_API_URL=_api_base(),
        email=email,
        title="Xác thực Email",
        SKIP_ROLE_GUARD=True,
        hide_sidebar=True,
        FEATURE_FLAGS=FEATURE_FLAG_DEFAULTS,
        ALLOW_AUTH_JS=True,  # trang OTP/Google có thể vẫn cần auth.js nếu bạn dùng API
    )
