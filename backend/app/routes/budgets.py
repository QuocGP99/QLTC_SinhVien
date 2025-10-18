# backend/app/routes/budgets.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from ..extensions import db
from ..models.budget import Budget
from ..models.category import Category

bp = Blueprint("budgets_api", __name__, url_prefix="/api/budgets")

# ---- helpers ----
def parse_month_str(s: str):
    # s: "YYYY-MM" -> (YYYY, MM) hoặc raise ValueError
    y, m = s.split("-", 1)
    y = int(y)
    m = int(m)
    if not (1 <= m <= 12):
        raise ValueError("month out of range")
    return y, m

def current_user_id():
    uid = get_jwt_identity()
    if isinstance(uid, dict):
        uid = uid.get("id")
    try:
        return int(uid) if uid is not None else None
    except Exception:
        return uid

def budget_to_dict(b: Budget):
    limit = float(b.limit_amount or 0)
    return {
        "id": b.id,
        "category_id": b.category_id,
        "category": getattr(b.category, "name", None),
        "year": b.period_year,
        "month": b.period_month,
        # FE đọc được cả 'limit' lẫn 'amount'
        "limit": limit,
        "amount": limit,
        "spent": 0.0,  # TODO: cộng từ expenses nếu có
    }

# ---- GET /api/budgets?month=YYYY-MM hoặc ?year=YYYY&month=MM ----
@bp.get("/")
@jwt_required(optional=True)  # cho phép xem khi chưa login nếu muốn
def list_budgets():
    q = Budget.query
    # lọc theo user nếu cần
    uid = current_user_id()
    if uid is not None:
        q = q.filter(Budget.user_id == uid)

    month_param = request.args.get("month")
    year_param = request.args.get("year")
    mm_param = request.args.get("month") if not month_param else None  # giữ tương thích nếu bạn vẫn truyền ?month=10

    if month_param and "-" in month_param:  # dạng YYYY-MM
        y, m = parse_month_str(month_param)
        q = q.filter(Budget.period_year == y, Budget.period_month == m)
    else:
        if year_param:
            q = q.filter(Budget.period_year == int(year_param))
        if mm_param and mm_param.isdigit():
            q = q.filter(Budget.period_month == int(mm_param))

    rows = q.order_by(Budget.period_year.desc(), Budget.period_month.desc()).all()
    items = [budget_to_dict(b) for b in rows]

    # KPI đơn giản
    total = sum(b["limit"] for b in items)
    spent = sum(b["spent"] for b in items)
    kpi = {"total": total, "spent": spent, "remain": total - spent}

    return jsonify({"items": items, "kpi": kpi})

# ---- POST /api/budgets  body: {month:"YYYY-MM", category_id:number, amount:number} ----
@bp.post("/")
@jwt_required()
def create_budget():
    data = request.get_json() or {}
    month_str = data.get("month", "")
    category_id = int(data.get("category_id") or 0)

    # FE đôi khi gửi 'limit' thay vì 'amount' -> ưu tiên amount, fallback sang limit
    amount = data.get("amount", data.get("limit", 0))
    try:
        amount = float(amount or 0)
    except Exception:
        amount = 0.0

    if not month_str or not category_id or amount <= 0:
        return jsonify({"msg": "month='YYYY-MM', category_id & amount > 0"}), 422

    try:
        y, m = parse_month_str(month_str)
    except Exception:
        return jsonify({"msg": "month phải có dạng 'YYYY-MM'"}), 422

    uid = current_user_id()
    if uid is None:
        return jsonify({"msg": "Yêu cầu đăng nhập"}), 401

    existed = (Budget.query
        .filter(
            Budget.user_id == uid,
            Budget.category_id == category_id,
            Budget.period_year == y,
            Budget.period_month == m,
        )
        .first()
    )

    if existed:
        # Upsert: cập nhật hạn mức nếu đã tồn tại
        existed.limit_amount = amount
        db.session.commit()
        return jsonify({
            "item": budget_to_dict(existed),
            "upsert": True,
            "msg": "Đã cập nhật ngân sách tháng này (đã tồn tại trước đó)"
        }), 200

    b = Budget(
        user_id=uid,
        category_id=category_id,
        period_year=y,
        period_month=m,
        limit_amount=amount,
    )
    db.session.add(b)
    db.session.commit()
    return jsonify({"item": budget_to_dict(b), "upsert": False}), 201

# ---- PUT /api/budgets/<id>  body: {category_id?, amount?} ----
@bp.put("/<int:bid>")
@jwt_required()
def update_budget(bid):
    data = request.get_json() or {}
    uid = current_user_id()
    b = Budget.query.get_or_404(bid)
    if uid is not None and b.user_id != uid:
        return jsonify({"msg": "Forbidden"}), 403

    # CHỈ cập nhật field hợp lệ, không nhận 'month'
    if "category_id" in data and int(data["category_id"]) > 0:
        b.category_id = int(data["category_id"])
    if "amount" in data and float(data["amount"]) > 0:
        b.limit_amount = float(data["amount"])

    db.session.commit()
    return jsonify({"item": budget_to_dict(b)})

# ---- DELETE /api/budgets/<id> ----
@bp.delete("/<int:bid>")
@jwt_required()
def delete_budget(bid):
    uid = current_user_id()
    b = Budget.query.get_or_404(bid)
    if uid is not None and b.user_id != uid:
        return jsonify({"msg": "Forbidden"}), 403
    db.session.delete(b)
    db.session.commit()
    return jsonify({"success": True})
