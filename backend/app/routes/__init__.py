from flask import Flask

# webp
from .web import bp as web_bp
from .auth import bp as auth_bp
from .expenses_api import bp as expenses_bp
from .incomes_api import bp as incomes_bp
from .categories import bp as categories_bp
from .budgets import bp as budgets_bp
from .savings import bp as savings_bp
from .subscriptions import bp as subscriptions_bp
from .money_sources import money_sources_bp
from .dashboard_api import bp as dashboard_api_bp
from .analytics import bp as analytics_bp
from .admin_users import bp as admin_users_bp
from .ocr_api import bp as ocr_api_bp
from .ai_api import bp as ai_bp
from .user_profile import bp as user_bp


def register_blueprints(app: Flask):

    # page
    app.register_blueprint(web_bp)
    # api
    app.register_blueprint(auth_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(incomes_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(dashboard_api_bp)
    app.register_blueprint(savings_bp)
    app.register_blueprint(subscriptions_bp)
    app.register_blueprint(money_sources_bp)
    app.register_blueprint(admin_users_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(ocr_api_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(user_bp)
