from ..extensions import db
from sqlalchemy.sql import func

class Expense(db.Model):
    __tablename__ = "expenses"

    id      = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    amount  = db.Column(db.Float, nullable=False)
    date    = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    note    = db.Column(db.String(255))
    payment_method = db.Column(db.String(50), nullable=False) # e.g., 'cash', 'credit_card', etc.

    category_id    = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True)

    category = db.relationship("Category", back_populates="expenses")

    def to_dict(self):
        return {
            "id": self.id,
            "amount": self.amount,
            "date": self.date.isoformat(),
            "note": self.note,
            "payment_method": self.payment_method,
            "category_id": self.category_id,
            "user_id": self.user_id,
            "category": self.category.name if self.category else None
        }