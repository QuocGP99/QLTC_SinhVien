# app/routes/dashboard_api.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.dashboard_service import get_month_summary
from ..services.financial_health_service import compute_financial_health

from datetime import date, datetime
import pytz

bp = Blueprint("dashboard_api", __name__, url_prefix="/api/dashboard")

@bp.get("/summary")
@jwt_required()
def get_summary():
    uid_raw = get_jwt_identity()
    try:
        user_id = int(uid_raw)
    except (TypeError, ValueError):
        # nếu identity không phải số thì trả 401 cho chắc
        return jsonify({"success": False, "message": "Invalid token identity"}), 401

    month = request.args.get("month")
    if not month:
        month = datetime.now(pytz.timezone("Asia/Bangkok")).strftime("%Y-%m")
    data = get_month_summary(user_id, month)
    return jsonify(data), 200


@bp.get("/health_score")
@jwt_required()
def dashboard_health_score():
    user_id = get_jwt_identity()
    today = date.today()

    data = compute_financial_health(
        user_id=user_id,
        year=today.year,
        month=today.month
    )
    return jsonify(data), 200