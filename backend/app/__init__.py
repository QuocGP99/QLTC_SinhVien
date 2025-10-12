# app/__init__.py
import os
from pathlib import Path
from flask import Flask
from .config import Config
from .extensions import db, migrate, cache, jwt
from .routes import register_blueprints
# from .routes.auth import bp as auth_bp
# from .routes.web import bp as web_bp

APP_FILE   = Path(__file__).resolve()
BACKEND_DIR = APP_FILE.parents[1]     # .../backend
ROOT_DIR    = APP_FILE.parents[2]     # .../QLTC_SinhVien
TEMPLATES_DIR = ROOT_DIR / "frontend" / "templates"
STATIC_DIR    = ROOT_DIR / "frontend" / "static"
INSTANCE_DIR  = BACKEND_DIR / "instance"   # .../backend/instance

# BASE_DIR = Path(__file__).resolve().parent.parent
# TEMPLATES_DIR = (BASE_DIR / "templates").as_posix()
# STATIC_DIR    = (BASE_DIR / "static").as_posix()
# INSTANCE_DIR  = (BASE_DIR / "instance")

def register_models():
    """
    Import tất cả models để SQLAlchemy metadata được load,
    giúp 'flask db migrate' phát hiện bảng/column.
    """
    from .models.user import User
    from .models.category import Category
    from .models.expense import Expense
    # nếu có các model khác, import thêm ở đây:
    # from .models.expense import Expense
    # from .models.xxx import Yyy
    return True

def create_app(config_class: type[Config] | None = None):
    app = Flask(
        __name__,
        instance_path=INSTANCE_DIR.as_posix(),
        instance_relative_config=True,
        template_folder=TEMPLATES_DIR.as_posix(),
        static_folder=STATIC_DIR.as_posix(),
    )

    app.config.from_object(config_class or Config)

    # Đảm bảo instance/ tồn tại
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

    # DB URI tuyệt đối (nếu ENV chưa override)
    db_path = (INSTANCE_DIR / "app.db").as_posix()
    app.config.setdefault("SQLALCHEMY_DATABASE_URI", f"sqlite:///{db_path}")
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

    # SECRET_KEY cho session (và JWT đã có trong config)
    app.secret_key = app.config.get("SECRET_KEY") or "dev-secret-change-me"

    # Init extensions
    db.init_app(app)
    cache.init_app(app)
    jwt.init_app(app)

    # Import models TRƯỚC khi init migrate để Alembic thấy metadata
    register_models()
    migrate.init_app(app, db)

    # Blueprints
    register_blueprints(app)
    # app.register_blueprint(auth_bp)  # /api/auth/...
    # app.register_blueprint(web_bp)   # /login, /register, /dashboard

    @app.get("/healthz")
    def healthz():
        return {"status": "ok", "db": app.config["SQLALCHEMY_DATABASE_URI"]}, 200

    return app
