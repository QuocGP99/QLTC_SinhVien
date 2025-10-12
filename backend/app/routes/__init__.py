from flask import Flask
#webp
from .web import bp as web_bp
from .auth import bp as auth_bp
from .expenses import bp as expenses_bp
from .categories import bp as categories_bp
from .budgets import bp as budgets_bp 
from .savings_goals import bp as goals_bp
from .dashboard_api import bp as dashboard_api_bp

def register_blueprints(app: Flask):

    #page
    app.register_blueprint(web_bp)
    #api
    app.register_blueprint(auth_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(dashboard_api_bp)
