# backend/app/models/__init__.py
from __future__ import annotations
from sqlalchemy import func
from ..extensions import db


# --- Mixin chung: id + timestamps ---
class TimestampMixin:
    created_at = db.Column(
        db.DateTime, server_default=func.current_timestamp(), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )


class BaseModel(db.Model, TimestampMixin):
    __abstract__ = True

    # THÊM AUTOINCREMENT
    id = db.Column(
        db.Integer, primary_key=True, autoincrement=True  # <<< CẦN THIẾT CHO POSTGRES
    )

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


# Import để Alembic thấy metadata
from .user import User
from .category import Category
from .payment_method import PaymentMethod
from .expense import Expense
from .income import Income
from .budget import Budget
from .saving import SavingsGoal
from .money_source import MoneySource


def register_models():
    pass


__all__ = [
    "User",
    "Category",
    "PaymentMethod",
    "Expense",
    "Income",
    "Budget",
    "SavingsGoal",
    "MoneySource",
    "register_models",
    "BaseModel",
    "TimestampMixin",
]
