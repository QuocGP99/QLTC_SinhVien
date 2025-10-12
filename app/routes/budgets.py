# app/routes/budgets.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date
from ..extensions import db
from ..models.budget import Budget
from ..models.category import Category
from ..services.budget_service import budget_stats_row, month_summary

bp = Blueprint("budgets", __name__, url_prefix="/api/budgets")

def _this_month():
    today = date.today()
    return f"{today.year:04d}-{today.month:02d}"

def ok(data=None, code=200):
    return jsonify({"success": True, "data": data}), code

def fail(msg, code=400):
    return jsonify({"success": False, "message": msg}), code

@bp.get("")
@jwt_required()
def list_budgets():
    user_id = get_jwt_identity()
    month = request.args.get("month") or _this_month()
    qs = Budget.query.filter_by(user_id=user_id, month=month).join(Category).order_by(Category.name.asc())
    rows = [budget_stats_row(b) for b in qs.all()]
    return ok({"items": rows, "summary": month_summary(user_id, month)})

@bp.get("/summary")
@jwt_required()
def get_summary():
    user_id = get_jwt_identity()
    month = request.args.get("month") or _this_month()
    return ok(month_summary(user_id, month))

@bp.post("")
@jwt_required()
def create_budget():
    user_id = get_jwt_identity()
    payload = request.get_json(force=True) or {}
    # Cho phép tạo một hoặc nhiều bản ghi
    items = payload if isinstance(payload, list) else [payload]
    created = []
    for it in items:
        category_id = it.get("category_id")
        amount = float(it.get("amount", 0))
        month = (it.get("month") or _this_month()).strip()
        if not category_id or amount <= 0:
            return fail("category_id và amount > 0 là bắt buộc", 422)
        # upsert theo unique (user,category,month)
        existing = Budget.query.filter_by(user_id=user_id, category_id=category_id, month=month).first()
        if existing:
            existing.amount = amount
            db.session.add(existing)
            db.session.flush()
            created.append(existing)
        else:
            b = Budget(user_id=user_id, category_id=category_id, month=month, amount=amount)
            db.session.add(b); db.session.flush()
            created.append(b)
    db.session.commit()
    return ok([budget_stats_row(b) for b in created], 201)

@bp.patch("/<int:budget_id>")
@jwt_required()
def update_budget(budget_id: int):
    user_id = get_jwt_identity()
    b = Budget.query.get_or_404(budget_id)
    if b.user_id != user_id:
        return fail("Không có quyền.", 403)
    data = request.get_json(force=True) or {}
    if "amount" in data:
        amt = float(data["amount"])
        if amt <= 0:
            return fail("amount phải > 0", 422)
        b.amount = amt
    if "month" in data:
        b.month = data["month"].strip()
    if "category_id" in data:
        b.category_id = int(data["category_id"])
    db.session.commit()
    return ok(budget_stats_row(b))

@bp.delete("/<int:budget_id>")
@jwt_required()
def delete_budget(budget_id: int):
    user_id = get_jwt_identity()
    b = Budget.query.get_or_404(budget_id)
    if b.user_id != user_id:
        return fail("Không có quyền.", 403)
    db.session.delete(b); db.session.commit()
    return ok({"id": budget_id})
