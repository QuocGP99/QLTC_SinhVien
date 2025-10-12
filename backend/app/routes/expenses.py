from datetime import date
from calendar import monthrange

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models.category import Category
from ..services.expense_service import (
    list_expenses as svc_list,
    create_expense as svc_create,
    get_expense as svc_get,
    update_expense as svc_update,
    delete_expense as svc_delete,
    ServiceError,
)

bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")

def ok(d=None, code=200):
    base = {"success": True}
    if isinstance(d, dict):
        base.update(d)
    return jsonify(base), code

def fail(msg="Bad request", code=400):
    return jsonify({"success": False, "message": msg}), code

def _month_to_range(month_str: str | None):
    if not month_str:
        return None, None
    y, m = map(int, month_str.split("-"))
    start = date(y, m, 1).isoformat()
    end = date(y, m, monthrange(y, m)[1]).isoformat()
    return start, end

@bp.get("/")   
@jwt_required()
def list_expenses_route():
    try:
        uid = int(get_jwt_identity())

        # hỗ trợ category_id (FE) -> service đang dùng category_name
        category_name = request.args.get("category")
        category_id = request.args.get("category_id", type=int)
        if category_id and not category_name:
            c = db.session.get(Category, category_id)
            category_name = c.name if c else None

        data = svc_list(
            user_id=uid,
            category_name=category_name,
            page=request.args.get("page", 1, type=int),
            per_page=request.args.get("per_page", 20, type=int),
        )
        return jsonify({"success": True, "data": data}), 200
    except ServiceError as e:
        return fail(e.message, e.status_code)

@bp.post("/")
@jwt_required()
def create_expense_route():
    try:
        uid = int(get_jwt_identity())
        payload = request.get_json(silent=True) or request.form or {}

        # map occurred_on -> date cho service
        if "occurred_on" in payload and "date" not in payload:
            payload["date"] = payload["occurred_on"]

        created = svc_create(uid, payload)
        return ok({"expense": created}, 201)
    except ServiceError as e:
        return fail(e.message, e.status_code)

@bp.get("/<int:expense_id>")
@jwt_required()
def get_expense_route(expense_id):
    try:
        uid = int(get_jwt_identity())
        item = svc_get(uid, expense_id)
        return ok({"expense": item})
    except ServiceError as e:
        return fail(e.message, e.status_code)

@bp.put("/<int:expense_id>")
@jwt_required()
def update_expense_route(expense_id):
    try:
        uid = int(get_jwt_identity())
        payload = request.get_json(silent=True) or request.form or {}
        if "occurred_on" in payload and "date" not in payload:
            payload["date"] = payload["occurred_on"]
        updated = svc_update(uid, expense_id, payload)
        return ok({"expense": updated})
    except ServiceError as e:
        return fail(e.message, e.status_code)

@bp.delete("<int:expense_id>")
@jwt_required()
def delete_expense_route(expense_id):
    try:
        uid = int(get_jwt_identity())
        deleted_id = svc_delete(uid, expense_id)
        return ok({"deleted_id": deleted_id})
    except ServiceError as e:
        return fail(e.message, e.status_code)
