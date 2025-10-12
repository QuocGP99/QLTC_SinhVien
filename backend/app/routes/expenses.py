from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..services.expense_service import (
    list_expenses, create_expense, get_expense as svc_get,
    update_expense as svc_update, delete_expense as svc_delete,
    ServiceError
)

bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")

@bp.get("/")
@jwt_required()
def list_expenses_route():
    try:
        user_id = int(get_jwt_identity())
        data = list_expenses(
            user_id=user_id,
            category_name=request.args.get("category"),
            start=request.args.get("start"),
            end=request.args.get("end"),
            page=request.args.get("page", 1, type=int),
            per_page=request.args.get("per_page", 20, type=int),
        )
        return jsonify(data), 200
    except ServiceError as e:
        return jsonify({"error": e.message}), e.status_code

@bp.post("/")
@jwt_required()
def create_expense_route():
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        created = create_expense(user_id, data)
        return jsonify(created), 201
    except ServiceError as e:
        return jsonify({"error": e.message}), e.status_code

@bp.get("/<int:expense_id>")
@jwt_required()
def get_expense_route(expense_id):
    try:
        user_id = int(get_jwt_identity())
        item = svc_get(user_id, expense_id)
        return jsonify(item), 200
    except ServiceError as e:
        return jsonify({"error": e.message}), e.status_code

@bp.put("/<int:expense_id>")
@jwt_required()
def update_expense_route(expense_id):
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        updated = svc_update(user_id, expense_id, data)
        return jsonify(updated), 200
    except ServiceError as e:
        return jsonify({"error": e.message}), e.status_code

@bp.delete("/<int:expense_id>")
@jwt_required()
def delete_expense_route(expense_id):
    try:
        user_id = int(get_jwt_identity())
        deleted_id = svc_delete(user_id, expense_id)
        return jsonify({"deleted_id": deleted_id}), 200
    except ServiceError as e:
        return jsonify({"error": e.message}), e.status_code
