from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Expense, Category
from datetime import date

bp = Blueprint("expenses", __name__)

@bp.get("")
@jwt_required()
def list_expenses():
    uid = get_jwt_identity()
    q = Expense.query.filter_by(user_id=uid).order_by(Expense.date.desc(), Expense.id.desc())

    #loc theo category
    cat = request.args.get("category")
    if cat:
        q = q.join(Category).filter(Category.name == cat)

    
    return jsonify([e.to_dict() for e in q.all]), 200
    
@bp.post("")
@jwt_required()
def create_expense():
    uid = get_jwt_identity()
    data = request.get_json() or {}
    e = Expense(
        amount = float(data.get("amount", 0)),
        date=data.get("date"),
        note=data.get("note"),
        payment_method=data.get("payment_method"),
        category_id=data.get("category_id"),
        user_id=uid,
    )
    db.session.add(e); db.session.commit()
    return jsonify(e.to_dict()), 201

