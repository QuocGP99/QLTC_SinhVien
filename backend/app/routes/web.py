# app/routes/web.py
from flask import Blueprint, render_template, redirect, url_for
import os

bp = Blueprint("web", __name__)

def _api_base():
    # Có thể override bằng ENV API_BASE_URL khi deploy
    return os.getenv("API_BASE_URL", "")

@bp.route("/")
def index():
    # Giao cho FE tự guard, redirect sang /login
    return redirect(url_for("web.login"))

@bp.route("/login")
def login():
    # Truyền API_BASE để JS biết URL gọi API
    return render_template("auth/login.html", BASE_API_URL=_api_base(), title="Đăng nhập")

@bp.route("/register")
def register():
    return render_template("auth/register.html", BASE_API_URL=_api_base(), title="Đăng ký")

@bp.route("/dashboard")
def dashboard():
    # Không kiểm tra session ở server. JS sẽ guard bằng token trong localStorage.
    return render_template("dashboard.html", BASE_API_URL=_api_base(), title="Dashboard")

@bp.route("/logout")
def logout():
    # Với AJAX, token lưu ở localStorage, nên chỉ cần điều hướng về /login.
    # JS trên trang dashboard sẽ clear localStorage khi bấm Đăng xuất.
    return redirect(url_for("web.login"))
