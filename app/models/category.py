from ..extensions import db

class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    type = db.Column(db.String(50), nullable=False, default = "expense")  # 'income' or 'expense'

    expenses = db.relationship(
        "Expense",
        back_populates="category",
        cascade="all, delete-orphan",
        lazy=True
        )
    