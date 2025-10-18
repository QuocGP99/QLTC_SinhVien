# backend/app/routes/savings.py
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models.saving import SavingsGoal, db
from decimal import Decimal
from datetime import date

bp = Blueprint("savings", __name__, url_prefix="/api/savings")

def to_dict(m: SavingsGoal):
    return {
        "id": m.id,
        "name": m.name,
        "description": m.description,
        "category": m.category,
        "priority": m.priority,
        "target_amount": float(m.target_amount or 0),
        "current_amount": float(m.current_amount or 0),
        "monthly_contribution": float(m.monthly_contribution or 0),
        "deadline": m.deadline.isoformat() if m.deadline else None,
        "status": m.status,
    }

@bp.get("")
@jwt_required()
def list_goals():
    user_id = get_jwt_identity()
    q = SavingsGoal.query.filter_by(user_id=user_id)
    status = request.args.get("status")
    if status: q = q.filter_by(status=status)
    items = [to_dict(x) for x in q.order_by(SavingsGoal.priority.asc(), SavingsGoal.id.desc()).all()]
    return jsonify({"items": items})

@bp.post("")
@jwt_required()
def create_goal():
    data = request.get_json() or {}
    user_id = get_jwt_identity()
    goal = SavingsGoal(
        user_id=user_id,
        name=data["name"],
        description=data.get("description"),
        category=data.get("category"),
        priority=data.get("priority","medium"),
        target_amount=Decimal(str(data.get("target_amount",0))),
        current_amount=Decimal(str(data.get("current_amount",0))),
        monthly_contribution=Decimal(str(data.get("monthly_contribution",0))),
        deadline=date.fromisoformat(data["deadline"]) if data.get("deadline") else None,
        status=data.get("status","active"),
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify(to_dict(goal)), 201

@bp.get("/<int:goal_id>")
@jwt_required()
def get_goal(goal_id):
    user_id = get_jwt_identity()
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    return jsonify(to_dict(m))

@bp.put("/<int:goal_id>")
@jwt_required()
def update_goal(goal_id):
    user_id = get_jwt_identity()
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}
    for k in ["name","description","category","priority","status"]:
        if k in data: setattr(m, k, data[k])
    for k in ["target_amount","current_amount","monthly_contribution"]:
        if k in data: setattr(m, k, Decimal(str(data[k])))
    if "deadline" in data:
        m.deadline = date.fromisoformat(data["deadline"]) if data["deadline"] else None
    db.session.commit()
    return jsonify(to_dict(m))

@bp.patch("/<int:goal_id>")
@jwt_required()
def patch_goal(goal_id):
    return update_goal(goal_id)

@bp.delete("/<int:goal_id>")
@jwt_required()
def delete_goal(goal_id):
    user_id = get_jwt_identity()
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    db.session.delete(m)
    db.session.commit()
    return "", 204

@bp.post("/<int:goal_id>/contribute")
@jwt_required()
def contribute(goal_id):
    from decimal import Decimal, InvalidOperation
    uid = get_jwt_identity()

    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=uid).first()
    if not goal:
        return jsonify({"success": False, "message": "Goal not found"}), 404

    data = request.get_json(silent=True) or {}
    raw_amount = data.get("amount", 0)

    # ✅ Dùng Decimal để tránh lỗi Decimal + float
    try:
        amount = Decimal(str(raw_amount))
    except (InvalidOperation, TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"success": False, "message": "Amount must be positive"}), 400

    cur = Decimal(str(goal.current_amount or 0))
    tgt = Decimal(str(goal.target_amount or 0))

    new_cur = cur + amount
    # (tuỳ chọn) không vượt target nếu đặt mục tiêu
    if tgt > 0 and new_cur > tgt:
        new_cur = tgt

    goal.current_amount = new_cur

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error while saving"}), 500

    # ✅ Dùng helper to_dict(m) thay vì goal.to_dict()
    return jsonify({"success": True, "item": to_dict(goal)}), 200

