from ..extensions import db
from sqlalchemy.sql import func

class Expense(db.Model):
    __tablename__ = "expenses"
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    note = db.Column(db.String(255))
    payment_method = db.Column(db.String(50), nullable=False) # e.g., 'cash', 'credit_card', etc.
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)

    category = db.relationship("Category", back_populates="expenses")

    def to_dict(self):
        return {
            "id": self.id,
            "amount": self.amount if self.amount is not None else None,
            "date": self.date.isoformat() if self.date else None,
            "note": self.note,
            "payment_method": self.payment_method,
            "categoty_id": self.category_id if getattr(self, "category", None) else None,
        }