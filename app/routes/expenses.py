from flask import Blueprint, request, jsonify
# from ..extensions import db
from ..models import Expense, Category
# from datetime import date

bp = Blueprint("expenses", __name__)

@bp.get("")
@bp.get("/")
def list_expenses():
    q = Expense.query.order_by(Expense.date.desc(), Expense.id.desc())
    cat = request.args.get("category")
    if cat:
        q = q.join(Category).filter(Category.name == cat)

    items = q.all()
    return jsonify([e.to_dict() for e in items]), 200
    
    # @bp.post("")
    # def create_expense():
    #     data = request.get_json() or {}
    #     e = Expense(
    #         amount = float(data.get("amount", 0)),
    #         date = date.fromisoformat(data["date"]) if data.get("date") else date.today(),
    #         note = data.get("note"),
    #         payment_method = data.get("payment_method"),
    #         cattegory_id = data.get("category_id"),
    #     )
    #     db.session.add(e); db.session.commit()
    #     return jsonify(e.to_dict(), 201)

