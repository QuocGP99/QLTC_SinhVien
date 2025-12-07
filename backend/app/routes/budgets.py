# backend/app/routes/budgets.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from ..extensions import db
from ..models.budget import Budget
from ..models.category import Category
from decimal import Decimal

from ..services.budget_service import spend_used
from ..services.budget_ai_service import projected_overshoot
from datetime import date

bp = Blueprint("budgets_api", __name__, url_prefix="/api/budgets")

# ---- helpers ----
def parse_month_str(s: str):
    # s: "YYYY-MM" -> (YYYY, MM) hoặc raise ValueError
    y, m = s.split("-", 1)
    y = int(y); m = int(m)
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

def _yyyy_mm(y: int, m: int) -> str:
    return f"{int(y):04d}-{int(m):02d}"

def budget_to_dict(b: Budget, yyyy_mm: str | None = None, force_user_id: int | None = None):
    """
    Nếu truyền yyyy_mm -> tự tính 'spent' từ bảng Expense đúng theo tháng.
    """
    limit = float(b.limit_amount or 0.0)
    spent_val = 0.0
    if yyyy_mm:
        uid = force_user_id if force_user_id is not None else b.user_id
        spent_val = spend_used(uid, b.category_id, yyyy_mm)

    return {
        "id": b.id,
        "category_id": b.category_id,
        "category": getattr(b.category, "name", None),
        "year": b.period_year,
        "month": b.period_month,
        # FE đọc được cả 'limit' lẫn 'amount'
        "limit": limit,
        "amount": limit,
        "spent": float(round(spent_val, 2)),
        "remaining": float(round(limit - spent_val, 2)),
        "percent_used": 0.0 if limit <= 0 else round(min(100.0, max(0.0, spent_val / limit * 100.0)), 2),
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

    month_param = request.args.get("month")  # có thể là "YYYY-MM" hoặc "MM" (cũ)
    year_param = request.args.get("year")

    yyyy_mm = None
    if month_param and "-" in month_param:  # dạng YYYY-MM
        y, m = parse_month_str(month_param)
        q = q.filter(Budget.period_year == y, Budget.period_month == m)
        yyyy_mm = _yyyy_mm(y, m)
    else:
        # tương thích: ?year=2025&month=10 hoặc chỉ ?month=10
        if year_param and month_param and month_param.isdigit():
            y, m = int(year_param), int(month_param)
            q = q.filter(Budget.period_year == y, Budget.period_month == m)
            yyyy_mm = _yyyy_mm(y, m)
        else:
            if year_param:
                q = q.filter(Budget.period_year == int(year_param))
            if month_param and month_param.isdigit():
                q = q.filter(Budget.period_month == int(month_param))

    rows = q.order_by(Budget.period_year.desc(), Budget.period_month.desc()).all()

    # Nếu lọc cụ thể một tháng -> tính spent đúng tháng đó; nếu không, trả về 0 để tránh hiểu sai
    items = [
        budget_to_dict(b, yyyy_mm=yyyy_mm if yyyy_mm else None, force_user_id=uid)
        for b in rows
    ]

    # KPI
    total = sum(it["limit"] for it in items)
    spent = sum(it["spent"] for it in items)
    kpi = {
        "total": float(round(total, 2)),
        "spent": float(round(spent, 2)),
        "remain": float(round(total - spent, 2)),
    }

    return jsonify({"items": items, "kpi": kpi})


# ---- GET /api/budgets/summary?month=YYYY-MM ----
@bp.get("/summary")
@jwt_required()
def get_summary():
    month_str = request.args.get("month", "")
    if not month_str or "-" not in month_str:
        return jsonify({"success": False, "message": "Thiếu hoặc sai month=YYYY-MM"}), 422

    y, m = parse_month_str(month_str)
    uid = current_user_id()

    q = Budget.query.filter(
        Budget.user_id == uid,
        Budget.period_year == y,
        Budget.period_month == m,
    )
    rows = q.order_by(Budget.id.asc()).all()

    # dùng service đã sửa spend_used(...)
    from ..services.budget_service import spend_used
    items = []
    total_budget = total_spent = 0.0
    for b in rows:
      limit = float(b.limit_amount or 0)
      spent = spend_used(uid, b.category_id, month_str)
      total_budget += limit; total_spent += spent
      items.append({
        "id": b.id,
        "category_id": b.category_id,
        "category": getattr(b.category, "name", None),
        "amount": limit,
        "spent": spent,
        "remaining": max(0.0, limit - spent),
        "percent_used": 0 if limit <= 0 else min(100.0, round(spent * 100 / limit)),
      })

    data = {
      "month": month_str,
      "total_budget": round(total_budget, 2),
      "total_spent": round(total_spent, 2),
      "total_remaining": round(total_budget - total_spent, 2),
      "percent_used": 0 if total_budget <= 0 else min(100.0, round(total_spent * 100 / total_budget)),
      "items": items
    }
    return jsonify({"success": True, "data": data})


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
    
    cat = Category.query.get(category_id)
    if not cat or cat.type != "expense":
        return jsonify({"msg": "Danh mục phải thuộc loại 'expense'."}), 422

    uid = current_user_id()
    if uid is None:
        return jsonify({"msg": "Yêu cầu đăng nhập"}), 401

    existed = (
        Budget.query
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
            "item": budget_to_dict(existed, yyyy_mm=month_str, force_user_id=uid),
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
    return jsonify({"item": budget_to_dict(b, yyyy_mm=month_str, force_user_id=uid), "upsert": False}), 201


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

    if "category_id" in data and int(data["category_id"]) > 0:
        new_cid = int(data["category_id"])
        cat = Category.query.get(new_cid)
    if not cat or cat.type != "expense":
        return jsonify({"msg": "Danh mục phải thuộc loại 'expense'."}), 422
    b.category_id = new_cid

    db.session.commit()
    # tự suy ra yyyy-mm của budget để trả về spent/remaining chính xác
    return jsonify({"item": budget_to_dict(b, yyyy_mm=_yyyy_mm(b.period_year, b.period_month), force_user_id=uid)})


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

# ai cảnh báo vượt ngân sách
@bp.route("/ai/warnings", methods=["GET"])
@jwt_required()
def budget_ai_warnings():
    user_id = get_jwt_identity()

    today = date.today()

    budgets = Budget.query.filter_by(
        user_id=user_id,
        period_year=today.year,
        period_month=today.month
    ).all()

    results = []
    for b in budgets:
        info = projected_overshoot(user_id, b)  # dùng tháng hiện tại
        info["category_id"] = b.category_id
        info["category_name"] = b.category.name
        results.append(info)

    return jsonify({"items": results})


@bp.post("/apply")
@jwt_required()
def apply_budget():
    data = request.get_json()
    user_id = current_user_id()

    category_id = data.get("category_id")
    amount = Decimal(str(data.get("amount", 0)))   # ⭐ convert đúng cách
    increment = data.get("increment", False)
    month = int(data.get("month"))
    year = int(data.get("year"))

    if not category_id or amount <= 0:
        return jsonify({"message": "Thiếu dữ liệu ngân sách"}), 400

    existing = Budget.query.filter_by(
        user_id=user_id,
        category_id=category_id,
        period_month=month,
        period_year=year
    ).first()

    # ---- ĐÃ CÓ NGÂN SÁCH → CẬP NHẬT ----
    if existing:
        if increment:
            existing.limit_amount = Decimal(existing.limit_amount) + amount
        else:
            existing.limit_amount = amount

        db.session.commit()

        return jsonify({
            "message": f"Ngân sách đã được cập nhật! Tổng mới = {float(existing.limit_amount):,.0f}đ"
        }), 200

    # ---- CHƯA CÓ → TẠO MỚI ----
    new_budget = Budget(
        user_id=user_id,
        category_id=category_id,
        period_month=month,
        period_year=year,
        limit_amount=amount,
        created_at=func.now(),
    )

    db.session.add(new_budget)
    db.session.commit()

    return jsonify({
        "message": f"Đã tạo ngân sách mới = {float(amount):,.0f}đ"
    }), 201
