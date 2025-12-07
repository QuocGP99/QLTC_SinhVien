# app/routes/dashboard_api.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.dashboard_service import get_month_summary
from ..services.financial_health_service import compute_financial_health
from datetime import date, datetime
from .. import db
from ..models.expense import Expense
from ..models.income import Income
from sqlalchemy import func

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

@bp.get("/balance")
@jwt_required()
def get_total_balance():
    """Tính tổng số dư = tổng thu nhập - tổng chi tiêu."""
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid token identity"}), 401

    # Tổng thu nhập
    total_income = (
        db.session.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(Income.user_id == user_id)
        .scalar()
    )

    # Tổng chi tiêu
    total_expense = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.user_id == user_id)
        .scalar()
    )

    balance = total_income - total_expense

    return jsonify({
        "success": True,
        "balance": balance
    }), 200

@bp.get("/balance_change")
@jwt_required()
def get_balance_change():
    user_id = int(get_jwt_identity())

    today = date.today()
    year = today.year
    month = today.month

    # Tính tháng trước
    if month == 1:
        prev_year = year - 1
        prev_month = 12
    else:
        prev_year = year
        prev_month = month - 1

    # Tạo object DATE đầu tháng
    this_month_date = date(year, month, 1)
    prev_month_date = date(prev_year, prev_month, 1)

    # =============== TỔNG THU NHẬP THÁNG NÀY ===============
    income_this = (
        db.session.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(
            Income.user_id == user_id,
            func.date_trunc('month', Income.received_at)
            == func.date_trunc('month', func.cast(this_month_date, db.Date)),
        )
        .scalar()
    )

    # =============== TỔNG CHI TIÊU THÁNG NÀY ===============
    expense_this = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user_id,
            func.date_trunc('month', Expense.spent_at)
            == func.date_trunc('month', func.cast(this_month_date, db.Date)),
        )
        .scalar()
    )

    # =============== TỔNG THU NHẬP THÁNG TRƯỚC ===============
    income_prev = (
        db.session.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(
            Income.user_id == user_id,
            func.date_trunc('month', Income.received_at)
            == func.date_trunc('month', func.cast(prev_month_date, db.Date)),
        )
        .scalar()
    )

    # =============== TỔNG CHI TIÊU THÁNG TRƯỚC ===============
    expense_prev = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user_id,
            func.date_trunc('month', Expense.spent_at)
            == func.date_trunc('month', func.cast(prev_month_date, db.Date)),
        )
        .scalar()
    )

    balance_this = income_this - expense_this
    balance_prev = income_prev - expense_prev

    return jsonify({
        "success": True,
        "balance_this": float(balance_this),
        "balance_prev": float(balance_prev)
    })
