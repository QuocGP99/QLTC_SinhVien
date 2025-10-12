from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from decimal import Decimal, InvalidOperation
from datetime import datetime
from ..extensions import db
from ..models.savings_goal import SavingsGoal
from ..services.goal_service import recommend_per_month

bp = Blueprint("goals", __name__, url_prefix="/api/goals")

def _d(x, field):
    try:
        return Decimal(str(x))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"'{field}' khong hop le")

def _parse_date(s: str, field: str):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        raise ValueError(f"'{field}' phai o dinh dang YYYY-MM-DD")

@bp.post("")
@jwt_required()
def create_goal():
    uid = get_jwt_identity()
    data = request.get_json(force=True) or {}
    try:
        name = (data.get("name") or "").strip()
        if not name:
            raise ValueError("name la bat buoc")
        target_amount = _d(data.get("target_amount"), "target_amount")
        current_amount = _d(data.get("current_amount", 0), "current_amount")
        deadline = _parse_date(data.get("deadline"), "deadline")
        priority = int(data.get("priority", 3))
        status = data.get("status", "planned")
    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    g = SavingsGoal(
        user_id=uid, name=name,
        target_amount=target_amount, current_amount=current_amount,
        deadline=deadline, priority=priority, status=status
    )
    db.session.add(g); db.session.commit()
    return jsonify({"success": True, "data": serialize_goal(g)}), 201

@bp.get("")
@jwt_required()
def list_goals():
    uid = get_jwt_identity()
    q = SavingsGoal.query.filter_by(user_id=uid).order_by(SavingsGoal.priority.asc(), SavingsGoal.deadline.asc())
    return jsonify({"success": True, "data": [serialize_goal(x) for x in q.all()]})

@bp.get("/<int:goal_id>")
@jwt_required()
def get_goal(goal_id):
    uid = get_jwt_identity()
    g = SavingsGoal.query.filter_by(id=goal_id, user_id=uid).first()
    if not g:
        return jsonify({"success": False, "message": "Goal khong ton tai"}), 404
    return jsonify({"success": True, "data": serialize_goal(g)})

@bp.patch("/<int:goal_id>")
@jwt_required()
def update_goal(goal_id):
    uid = get_jwt_identity()
    g = SavingsGoal.query.filter_by(id=goal_id, user_id=uid).first()
    if not g:
        return jsonify({"success": False, "message": "Goal khong ton tai"}), 404

    data = request.get_json(force=True) or {}
    try:
        if "name" in data: g.name = (data["name"] or "").strip() or g.name
        if "target_amount" in data: g.target_amount = _d(data["target_amount"], "target_amount")
        if "current_amount" in data: g.current_amount = _d(data["current_amount"], "current_amount")
        if "deadline" in data: g.deadline = _parse_date(data["deadline"], "deadline")
        if "priority" in data: g.priority = int(data["priority"])
        if "status" in data: g.status = data["status"]
        db.session.commit()
    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    return jsonify({"success": True, "data": serialize_goal(g)})

@bp.delete("/<int:goal_id>")
@jwt_required()
def delete_goal(goal_id):
    uid = get_jwt_identity()
    g = SavingsGoal.query.filter_by(id=goal_id, user_id=uid).first()
    if not g:
        return jsonify({"success": False, "message": "Goal khong ton tai"}), 404
    db.session.delete(g); db.session.commit()
    return jsonify({"success": True})

@bp.get("/<int:goal_id>/recommendation")
@jwt_required()
def recommendation(goal_id):
    uid = get_jwt_identity()
    g = SavingsGoal.query.filter_by(id=goal_id, user_id=uid).first()
    if not g:
        return jsonify({"success": False, "message": "Goal khong ton tai"}), 404
    advice = recommend_per_month(g.id).to_dict()
    return jsonify({"success": True, "data": {**serialize_goal(g), "recommendation": advice}})

def serialize_goal(g: SavingsGoal) -> dict:
    return {
        "id": g.id,
        "user_id": g.user_id,
        "name": g.name,
        "target_amount": str(g.target_amount),
        "current_amount": str(g.current_amount),
        "deadline": g.deadline.isoformat(),
        "priority": g.priority,
        "status": g.status,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
        "remaining_amount": str(g.remaining_amount()),
        "months_left": g.months_left(),
    }
