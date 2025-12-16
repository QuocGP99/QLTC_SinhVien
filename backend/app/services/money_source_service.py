"""
Money Source Service - Business logic for fund management
"""

from app.models.money_source import MoneySource
from app.extensions import db
from sqlalchemy import func


class MoneySourceService:
    """Service for managing money sources (wallets, cash, bank accounts, etc.)"""

    @staticmethod
    def create_money_source(user_id, name, type, balance, description=None):
        """Create a new money source"""
        source = MoneySource(
            user_id=user_id,
            name=name,
            type=type,
            balance=balance,
            description=description,
            is_active=True,
        )
        db.session.add(source)
        db.session.commit()
        return source

    @staticmethod
    def get_money_source(source_id, user_id):
        """Get a specific money source"""
        return MoneySource.query.filter_by(id=source_id, user_id=user_id).first()

    @staticmethod
    def get_all_money_sources(user_id, active_only=False):
        """Get all money sources for a user"""
        query = MoneySource.query.filter_by(user_id=user_id)
        if active_only:
            query = query.filter_by(is_active=True)
        return query.order_by(MoneySource.created_at.desc()).all()

    @staticmethod
    def update_money_source(source_id, user_id, **kwargs):
        """Update a money source"""
        source = MoneySource.query.filter_by(id=source_id, user_id=user_id).first()
        if not source:
            return None

        # Only allow updating specific fields
        allowed_fields = {"name", "type", "balance", "description", "is_active"}
        for key, value in kwargs.items():
            if key in allowed_fields and value is not None:
                setattr(source, key, value)

        db.session.commit()
        return source

    @staticmethod
    def delete_money_source(source_id, user_id):
        """Delete a money source"""
        source = MoneySource.query.filter_by(id=source_id, user_id=user_id).first()
        if not source:
            return False

        db.session.delete(source)
        db.session.commit()
        return True

    @staticmethod
    def get_total_balance(user_id, active_only=True):
        """Get total balance across all money sources"""
        query = MoneySource.query.filter_by(user_id=user_id)
        if active_only:
            query = query.filter_by(is_active=True)

        total = query.with_entities(func.sum(MoneySource.balance)).scalar()
        return float(total) if total else 0.0

    @staticmethod
    def get_balance_by_type(user_id):
        """Get balance breakdown by type"""
        results = (
            db.session.query(
                MoneySource.type,
                func.sum(MoneySource.balance).label("total"),
                func.count(MoneySource.id).label("count"),
            )
            .filter(MoneySource.user_id == user_id, MoneySource.is_active == True)
            .group_by(MoneySource.type)
            .all()
        )

        return [
            {
                "type": r[0],
                "type_display": MoneySource.get_type_display(r[0]),
                "type_icon": MoneySource.get_type_icon(r[0]),
                "balance": float(r[1]) if r[1] else 0.0,
                "count": r[2],
            }
            for r in results
        ]

    @staticmethod
    def get_money_source_stats(user_id):
        """Get statistics about money sources"""
        sources = MoneySource.query.filter_by(user_id=user_id, is_active=True).all()

        return {
            "total_balance": MoneySourceService.get_total_balance(user_id),
            "total_sources": len(sources),
            "balance_by_type": MoneySourceService.get_balance_by_type(user_id),
        }

    @staticmethod
    def adjust_balance(source_id, user_id, amount):
        """Adjust balance of a money source (for transaction reconciliation)"""
        source = MoneySource.query.filter_by(id=source_id, user_id=user_id).first()
        if not source:
            return None

        source.balance += amount
        db.session.commit()
        return source

    @staticmethod
    def sync_expense_to_source(money_source_id, user_id, old_amount, new_amount):
        """Sync expense amount change to money source balance.
        Used when expense is added/updated/deleted.
        old_amount: previous amount (0 if new)
        new_amount: current amount (0 if deleted)
        """
        if not money_source_id:
            return None

        source = MoneySource.query.filter_by(
            id=money_source_id, user_id=user_id
        ).first()
        if not source:
            return None

        # Reverse old deduction
        source.balance += float(old_amount) if old_amount else 0.0
        # Apply new deduction
        source.balance -= float(new_amount) if new_amount else 0.0
        db.session.commit()
        return source

    @staticmethod
    def sync_income_to_source(money_source_id, user_id, old_amount, new_amount):
        """Sync income amount change to money source balance.
        Used when income is added/updated/deleted.
        old_amount: previous amount (0 if new)
        new_amount: current amount (0 if deleted)
        """
        if not money_source_id:
            return None

        source = MoneySource.query.filter_by(
            id=money_source_id, user_id=user_id
        ).first()
        if not source:
            return None

        # Reverse old addition
        source.balance -= float(old_amount) if old_amount else 0.0
        # Apply new addition
        source.balance += float(new_amount) if new_amount else 0.0
        db.session.commit()
        return source
