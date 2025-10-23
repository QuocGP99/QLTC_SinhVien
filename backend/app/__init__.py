# backend/app/__init__.py
import os
from pathlib import Path
from flask import Flask
from dotenv import load_dotenv  # ▶ đọc .env sớm
from .config import Config
from .extensions import db, migrate, cache, jwt, mail
from .routes import register_blueprints
from datetime import datetime


# ── Paths
APP_FILE     = Path(__file__).resolve()
BACKEND_DIR  = APP_FILE.parents[1]       # .../backend
ROOT_DIR     = APP_FILE.parents[2]       # .../QLTC_SinhVien
TEMPLATES_DIR = ROOT_DIR / "frontend" / "templates"
STATIC_DIR    = ROOT_DIR / "frontend" / "static"
INSTANCE_DIR  = BACKEND_DIR / "instance"   # .../backend/instance

def register_models():
    from .models.user import User
    from .models.category import Category
    from .models.expense import Expense
    from .models.budget import Budget
    from .models.saving import SavingsGoal
    return True

def create_app(config_class: type[Config] | None = None):
    # ▶ nạp .env sớm để os.getenv(...) có giá trị
    load_dotenv()

    app = Flask(
        __name__,
        instance_path=INSTANCE_DIR.as_posix(),
        instance_relative_config=True,
        template_folder=TEMPLATES_DIR.as_posix(),
        static_folder=STATIC_DIR.as_posix(),
    )

    # Base config từ class (đọc mặc định & các ENV mà Config có xử lý)
    app.config.from_object(config_class or Config)

    # Đảm bảo instance/ tồn tại
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

    # ▶ Ưu tiên DATABASE_URL từ .env, nếu không có thì rơi về file trong backend/instance/app.db
    env_db_url = os.getenv("DATABASE_URL")
    if env_db_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = env_db_url
    else:
        db_path = (INSTANCE_DIR / "app.db").as_posix()
        app.config.setdefault("SQLALCHEMY_DATABASE_URI", f"sqlite:///{db_path}")

    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

    # SECRET_KEY cho session (JWT key set riêng trong Config/.env)
    app.secret_key = app.config.get("SECRET_KEY") or "dev-secret-change-me"

    # ▶ Cache: chỉ init nếu có cấu hình để tránh warning
    cache_type = os.getenv("CACHE_TYPE")
    if cache_type:
        app.config["CACHE_TYPE"] = cache_type
        app.config["CACHE_DEFAULT_TIMEOUT"] = int(os.getenv("CACHE_DEFAULT_TIMEOUT", "300"))
        cache.init_app(app)

    # Init DB/JWT
    db.init_app(app)
    jwt.init_app(app)

    # Import models trước khi init migrate để Alembic thấy metadata
    register_models()

    # ▶ Cố định thư mục migrations ở backend/migrations (đỡ phải -d mỗi lần)
    migrate.init_app(app, db, directory=(BACKEND_DIR / "migrations").as_posix())

    mail.init_app(app) # Initialize Flask-Mail

    # Blueprints
    register_blueprints(app)
    app.jinja_env.globals['now'] = datetime.now

    @app.get("/healthz")
    def health_check():
        return {
            "status": "ok",
            "db": app.config.get("SQLALCHEMY_DATABASE_URI"),
            "cache": app.config.get("CACHE_TYPE", "disabled")
        }, 200
    
     # --- Jinja filters: tiền VND & hiển thị +/- ---
    def format_vnd(n):
        try:
            return f"{float(n):,.0f} đ".replace(",", ".")
        except Exception:
            return f"{n} đ"

    def sign_amount(amount, tx_type='expense'):
        # Chi tiêu -> âm, Thu nhập -> dương
        s = "-" if tx_type == "expense" else "+"
        return f"{s}{format_vnd(amount)}"

    app.jinja_env.filters["vnd"]  = format_vnd
    app.jinja_env.filters["samt"] = sign_amount

    return app
