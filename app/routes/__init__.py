from flask import Flask
from app.routes.expenses import bp as expenses_bp
from app.routes.auth import bp as auth_bp
from app.routes.categories import bp as categories_bp
from app.routes.budgets import bp as budgets_bp 
from .savings_goals import bp as goals_bp
from .dashboard_api import bp as dashboard_api_bp

def register_blueprints(app: Flask):
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(dashboard_api_bp)
