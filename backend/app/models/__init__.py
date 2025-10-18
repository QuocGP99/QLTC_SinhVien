# backend/app/models/__init__.py
from __future__ import annotations
from sqlalchemy import func
from ..extensions import db

# --- Mixin chung: id + timestamps ---
class TimestampMixin:
    created_at = db.Column(db.DateTime, server_default=func.current_timestamp(), nullable=False)
    updated_at = db.Column(
        db.DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )

class BaseModel(db.Model, TimestampMixin):
    __abstract__ = True
    id = db.Column(db.Integer, primary_key=True)

    def to_dict(self):
        # tuỳ bạn mở rộng thêm từng model
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

# Import để Alembic thấy metadata
from .user import User
from .category import Category
from .payment_method import PaymentMethod
from .expense import Expense
from .income import Income
from .budget import Budget
from .saving import SavingsGoal

def register_models():
    # Hàm này chỉ để giữ API cũ nếu các nơi khác có gọi
    pass

__all__ = [
    "User", "Category", "PaymentMethod",
    "Expense", "Income", "Budget", "SavingsGoal",
    "register_models", "BaseModel", "TimestampMixin",
]
