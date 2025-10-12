# app/routes/dashboard_api.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.dashboard_service import get_month_summary
from datetime import datetime
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
