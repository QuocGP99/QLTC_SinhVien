from flask import Flask
from .config import Config
from .extensions import db, migrate
from .models import register_models

def create_app(config_class: type[Config] | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)

    #Nạp config
    app.config.from_object(config_class or Config)

    #Tạo thư mục instance(nơi chứa app.db)
    import os
    os.makedirs(app.instance_path, exist_ok=True)

    #khởi tao các extension
    db.init_app(app)
    migrate.init_app(app, db)

    #import models để Alembic thấy metadata
    register_models(db)
    
    if config_class is None:
        config_class = Config
    app.config.from_object(config_class)
    
    db.init_app(app)
    migrate.init_app(app, db)
    
    register_models(db)
    
    with app.app_context():
        from . import routes  # Import routes to register them with the app
    
    return app
