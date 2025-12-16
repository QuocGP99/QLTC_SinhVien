# backend/app/routes/savings.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from decimal import Decimal, InvalidOperation
from datetime import date, datetime

from ..models.saving import SavingsGoal, SavingsHistory, db

bp = Blueprint("savings", __name__, url_prefix="/api/savings")


# ---------- helpers ----------
def _uid():
    uid = get_jwt_identity()
    if isinstance(uid, dict):
        uid = uid.get("id")
    return int(uid) if uid is not None else None


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
        # NEW
        "auto_contribute": bool(m.auto_contribute),
        "contribute_interval": m.contribute_interval or "monthly",
    }


def history_to_dict(h: SavingsHistory):
    return {
        "id": h.id,
        "amount": float(h.amount or 0),
        "method": h.method,
        "interval": h.interval,
        "note": h.note,
        "created_at": h.created_at.isoformat() if h.created_at else None,
        "remaining_after": float(h.goal.current_amount or 0),
    }


def _is_same_month(d1: datetime, d2: datetime) -> bool:
    return d1.year == d2.year and d1.month == d2.month


def _is_same_isoweek(d1: datetime, d2: datetime) -> bool:
    # ISO week: (year, week, weekday)
    return d1.isocalendar()[:2] == d2.isocalendar()[:2]


def _apply_auto_contributions(user_id: int):
    """
    Lazy apply: mỗi lần user gọi API savings mình sẽ kiểm tra
    goal nào bật auto thì xem tháng/tuần hiện tại đã có history AUTO chưa.
    Nếu chưa -> tạo 1 history + tăng current_amount.
    """
    now = datetime.utcnow()
    goals = SavingsGoal.query.filter_by(user_id=user_id, auto_contribute=True).all()
    changed = False

    for g in goals:
        interval = g.contribute_interval or "monthly"
        amount = Decimal(str(g.monthly_contribution or 0))
        if amount <= 0:
            continue

        # lấy history AUTO gần nhất
        last_auto: SavingsHistory | None = (
            SavingsHistory.query.filter_by(
                user_id=user_id,
                goal_id=g.id,
                method="auto",
                interval=interval,
            )
            .order_by(SavingsHistory.created_at.desc())
            .first()
        )

        need_create = False
        if interval == "monthly":
            if not last_auto:
                need_create = True
            else:
                if not _is_same_month(last_auto.created_at, now):
                    need_create = True
        else:  # weekly
            if not last_auto:
                need_create = True
            else:
                if not _is_same_isoweek(last_auto.created_at, now):
                    need_create = True

        if need_create:
            # tăng current_amount nhưng không vượt target
            cur = Decimal(str(g.current_amount or 0))
            tgt = Decimal(str(g.target_amount or 0))
            new_cur = cur + amount
            if tgt > 0 and new_cur > tgt:
                new_cur = tgt
            g.current_amount = new_cur

            # tạo history
            h = SavingsHistory(
                goal_id=g.id,
                user_id=user_id,
                amount=amount,
                method="auto",
                interval=interval,
                note=f"Tự động góp theo { 'tháng' if interval=='monthly' else 'tuần' }",
            )
            db.session.add(h)
            changed = True

    if changed:
        db.session.commit()


# ---------- ROUTES ----------


@bp.get("")
@jwt_required()
def list_goals():
    user_id = _uid()
    _apply_auto_contributions(user_id)  # đảm bảo số mới nhất
    q = SavingsGoal.query.filter_by(user_id=user_id)
    status = request.args.get("status")
    if status:
        q = q.filter_by(status=status)
    items = [
        to_dict(x)
        for x in q.order_by(SavingsGoal.priority.asc(), SavingsGoal.id.desc()).all()
    ]
    return jsonify({"items": items})


@bp.post("")
@jwt_required()
def create_goal():
    data = request.get_json() or {}
    user_id = _uid()

    # Validate deadline is not in the past
    if data.get("deadline"):
        try:
            deadline = date.fromisoformat(data["deadline"])
            if deadline < date.today():
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": "Ngày hoàn thành không thể ở trong quá khứ",
                        }
                    ),
                    400,
                )
        except (ValueError, TypeError):
            return (
                jsonify({"success": False, "message": "Định dạng ngày không hợp lệ"}),
                400,
            )
    else:
        return (
            jsonify({"success": False, "message": "Ngày hoàn thành là bắt buộc"}),
            400,
        )

    goal = SavingsGoal(
        user_id=user_id,
        name=data["name"],
        description=data.get("description"),
        category=data.get("category"),
        priority=data.get("priority", "medium"),
        target_amount=Decimal(str(data.get("target_amount", 0))),
        current_amount=Decimal(str(data.get("current_amount", 0))),
        monthly_contribution=Decimal(str(data.get("monthly_contribution", 0))),
        deadline=deadline,
        status=data.get("status", "active"),
        auto_contribute=bool(data.get("auto_contribute", False)),
        contribute_interval=data.get("contribute_interval", "monthly"),
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify(to_dict(goal)), 201


@bp.get("/<int:goal_id>")
@jwt_required()
def get_goal(goal_id):
    user_id = _uid()
    _apply_auto_contributions(user_id)
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    return jsonify(to_dict(m))


# NEW: chi tiết + lịch sử
@bp.get("/<int:goal_id>/detail")
@jwt_required()
def goal_detail(goal_id):
    user_id = _uid()
    _apply_auto_contributions(user_id)
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()

    hist = (
        SavingsHistory.query.filter_by(goal_id=goal_id, user_id=user_id)
        .order_by(SavingsHistory.created_at.desc())
        .limit(30)
        .all()
    )
    return jsonify(
        {
            "goal": to_dict(m),
            "history": [history_to_dict(h) for h in hist],
        }
    )


# NEW: chỉ lấy history
@bp.get("/<int:goal_id>/history")
@jwt_required()
def goal_history(goal_id):
    user_id = _uid()
    hist = (
        SavingsHistory.query.filter_by(goal_id=goal_id, user_id=user_id)
        .order_by(SavingsHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return jsonify({"items": [history_to_dict(h) for h in hist]})


@bp.put("/<int:goal_id>")
@jwt_required()
def update_goal(goal_id):
    user_id = _uid()
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}
    for k in ["name", "description", "category", "priority", "status"]:
        if k in data:
            setattr(m, k, data[k])
    for k in ["target_amount", "current_amount", "monthly_contribution"]:
        if k in data:
            setattr(m, k, Decimal(str(data[k])))
    if "deadline" in data:
        if data["deadline"]:
            try:
                deadline = date.fromisoformat(data["deadline"])
                if deadline < date.today():
                    return jsonify({"success": False, "message": "Ngày hoàn thành không thể ở trong quá khứ"}), 400
                m.deadline = deadline
            except (ValueError, TypeError):
                return jsonify({"success": False, "message": "Định dạng ngày không hợp lệ"}), 400
        else:
            m.deadline = None

    # NEW
    if "auto_contribute" in data:
        m.auto_contribute = bool(data["auto_contribute"])
    if "contribute_interval" in data:
        if data["contribute_interval"] in ("monthly", "weekly"):
            m.contribute_interval = data["contribute_interval"]

    db.session.commit()
    return jsonify(to_dict(m))


@bp.patch("/<int:goal_id>")
@jwt_required()
def patch_goal(goal_id):
    return update_goal(goal_id)


@bp.delete("/<int:goal_id>")
@jwt_required()
def delete_goal(goal_id):
    user_id = _uid()
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    db.session.delete(m)
    db.session.commit()
    return "", 204


# NEW: cập nhật setting (toggle + weekly/monthly) từ modal
@bp.patch("/<int:goal_id>/settings")
@jwt_required()
def update_settings(goal_id):
    user_id = _uid()
    m = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}

    if "auto_contribute" in data:
        m.auto_contribute = bool(data["auto_contribute"])

    if "contribute_interval" in data:
        iv = data["contribute_interval"]
        if iv in ("monthly", "weekly"):
            m.contribute_interval = iv

    if "monthly_contribution" in data:
        m.monthly_contribution = Decimal(str(data["monthly_contribution"] or 0))

    db.session.commit()
    return jsonify(to_dict(m))


# góp thủ công + log history
@bp.post("/<int:goal_id>/contribute")
@jwt_required()
def contribute(goal_id):
    uid = _uid()
    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=uid).first()
    if not goal:
        return jsonify({"success": False, "message": "Goal not found"}), 404

    data = request.get_json(silent=True) or {}
    raw_amount = data.get("amount", 0)

    try:
        amount = Decimal(str(raw_amount))
    except (InvalidOperation, TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"success": False, "message": "Amount must be positive"}), 400

    cur = Decimal(str(goal.current_amount or 0))
    tgt = Decimal(str(goal.target_amount or 0))
    new_cur = cur + amount
    if tgt > 0 and new_cur > tgt:
        new_cur = tgt

    goal.current_amount = new_cur

    # ghi lịch sử
    hist = SavingsHistory(
        goal_id=goal.id,
        user_id=uid,
        amount=amount,
        method="manual",
        interval=goal.contribute_interval or "monthly",
        note="Cộng thủ công",
    )
    db.session.add(hist)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error while saving"}), 500

    return jsonify({"success": True, "item": to_dict(goal)}), 200
