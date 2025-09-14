from flask import Flask
from .expenses import bp as expenses_bp

def register_blueprints(app: Flask):
    app.register_blueprint(expenses_bp, url_prefix="/api/expenses")