from __future__ import annotations
from sqlalchemy.orm import relationship
from sqlalchemy import CheckConstraint
from . import BaseModel, db
from werkzeug.security import generate_password_hash, check_password_hash


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('user','admin')", name="ck_user_role"),)

    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(255))
    avatar = db.Column(db.String(255), nullable=True, default=None)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(16), nullable=False, default="user")
    is_verified = db.Column(db.Boolean, nullable=False, default=False)

    # Relations (giữ nguyên)
    categories = relationship(
        "Category",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    payment_methods = relationship(
        "PaymentMethod",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    expenses = relationship("Expense", back_populates="user", passive_deletes=True)
    incomes = relationship("Income", back_populates="user", passive_deletes=True)
    budgets = relationship("Budget", back_populates="user", passive_deletes=True)
    savings_goals = relationship(
        "SavingsGoal", back_populates="user", passive_deletes=True
    )
    subscriptions = relationship(
        "Subscription",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, raw_password)

    def to_public(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "avatar": self.avatar,
            "role": self.role,
            "is_verified": self.is_verified,
        }
