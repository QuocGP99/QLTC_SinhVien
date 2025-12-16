"""
Money Source Model - Represents different sources of funds (wallets, cash, bank accounts, etc.)
"""

from datetime import datetime
from app.extensions import db


class MoneySource(db.Model):
    __tablename__ = "money_sources"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    name = db.Column(
        db.String(255), nullable=False
    )  # e.g., "Ví Momo", "Tiền mặt", "Tài khoản Agribank"
    type = db.Column(
        db.String(50), nullable=False
    )  # e.g., "ewallet", "cash", "bank_account", "credit_card"
    balance = db.Column(db.Float, default=0.0, nullable=False)  # Current balance in VND
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationship
    user = db.relationship(
        "User",
        backref=db.backref(
            "money_sources", lazy="dynamic", cascade="all, delete-orphan"
        ),
    )

    def __repr__(self):
        return f"<MoneySource {self.name} ({self.type}): {self.balance}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "balance": self.balance,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @staticmethod
    def get_type_display(type_code):
        """Get Vietnamese display name for type"""
        type_map = {
            "ewallet": "Ví điện tử",
            "cash": "Tiền mặt",
            "bank_account": "Tài khoản ngân hàng",
            "credit_card": "Thẻ tín dụng",
            "savings": "Tiết kiệm",
            "investment": "Đầu tư",
            "other": "Khác",
        }
        return type_map.get(type_code, type_code)

    @staticmethod
    def get_type_icon(type_code):
        """Get Bootstrap icon class for type"""
        icon_map = {
            "ewallet": "bi-phone",
            "cash": "bi-cash-coin",
            "bank_account": "bi-bank",
            "credit_card": "bi-credit-card",
            "savings": "bi-piggy-bank",
            "investment": "bi-graph-up",
            "other": "bi-wallet2",
        }
        return icon_map.get(type_code, "bi-wallet2")
