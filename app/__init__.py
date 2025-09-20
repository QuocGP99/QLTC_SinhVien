from flask import Flask
from .config import Config
from .extensions import db, migrate, cache, jwt
from .models import register_models
from .routes import register_blueprints

def create_app(config_class: type[Config] | None = None):
    app = Flask(__name__, instance_relative_config=True)

    #Nạp config
    app.config.from_object(config_class or Config)

    #Tạo thư mục instance(nơi chứa app.db)
    import os
    os.makedirs(app.instance_path, exist_ok=True)

    #khởi tao các extension
    db.init_app(app)
    migrate.init_app(app, db)
    cache.init_app(app)
    jwt.init_app(app)

    #import models để Alembic thấy metadata
    register_models()
    register_blueprints(app)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}, 200
    
    @app.get("/")
    def index():
        return {"message": "Backend is running", "docs": ["/healthz", "/api/expenses"]}, 200
    
    return app


