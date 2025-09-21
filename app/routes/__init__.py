from flask import Flask
from .expenses import bp as expenses_bp
from .auth import bp as auth_bp
from .categories import bp as categories_bp  

def register_blueprints(app: Flask):
    app.register_blueprint(expenses_bp, url_prefix="/api/expenses")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(categories_bp, url_prefix="/api/categories")