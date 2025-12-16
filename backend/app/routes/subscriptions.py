# backend/app/routes/subscriptions.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date
from ..models.subscription import Subscription
from ..services.subscription_service import SubscriptionService
from ..extensions import db

bp = Blueprint("subscriptions", __name__, url_prefix="/api/subscriptions")


# ---- Helpers ----
def _uid():
    """Get current user ID from JWT"""
    uid = get_jwt_identity()
    if isinstance(uid, dict):
        uid = uid.get("id")
    return int(uid) if uid is not None else None


def to_dict(sub: Subscription) -> dict:
    """Convert Subscription model to dict"""
    return {
        "id": sub.id,
        "name": sub.name,
        "description": sub.description,
        "price": sub.price,
        "cycle_months": sub.cycle_months,
        "category": sub.category,
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "next_billing_date": sub.next_billing_date.isoformat() if sub.next_billing_date else None,
        "logo_url": sub.logo_url,
        "status": sub.status,
        "notes": sub.notes,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "updated_at": sub.updated_at.isoformat() if sub.updated_at else None,
        "days_until_billing": sub.days_until_billing(),
        "is_overdue": sub.is_overdue(),
    }


# ---- ROUTES ----

@bp.get("")
@jwt_required()
def list_subscriptions():
    """Lấy danh sách subscription của user"""
    user_id = _uid()
    status = request.args.get("status")  # Optional: active, paused, cancelled
    
    subs = SubscriptionService.get_user_subscriptions(user_id, status)
    items = [to_dict(s) for s in subs]
    
    # KPI stats
    monthly_cost = SubscriptionService.get_monthly_cost(user_id, "active")
    category_stats = SubscriptionService.get_category_stats(user_id, "active")
    
    return jsonify({
        "items": items,
        "stats": {
            "monthly_cost": monthly_cost,
            "category_breakdown": category_stats,
            "total_count": len(items),
        }
    })


@bp.post("")
@jwt_required()
def create_subscription():
    """Tạo subscription mới"""
    user_id = _uid()
    data = request.get_json() or {}
    
    # Validate required fields
    if not data.get("name") or not data.get("price"):
        return jsonify({"success": False, "message": "name và price là bắt buộc"}), 400
    
    try:
        start_date = date.fromisoformat(data.get("start_date", date.today().isoformat()))
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "start_date không hợp lệ"}), 400
    
    try:
        sub = SubscriptionService.create_subscription(
            user_id=user_id,
            name=data["name"],
            price=int(data["price"]),
            start_date=start_date,
            cycle_months=int(data.get("cycle_months", 1)),
            category=data.get("category", "Other"),
            notes=data.get("notes"),
        )
        return jsonify({"success": True, "item": to_dict(sub)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 400


@bp.get("/<int:sub_id>")
@jwt_required()
def get_subscription(sub_id):
    """Lấy chi tiết subscription"""
    user_id = _uid()
    sub = Subscription.query.filter_by(id=sub_id, user_id=user_id).first_or_404()
    
    # Update next_billing_date nếu cần
    SubscriptionService.process_billing_date(sub)
    
    return jsonify({"item": to_dict(sub)})


@bp.put("/<int:sub_id>")
@jwt_required()
def update_subscription(sub_id):
    """Cập nhật subscription"""
    user_id = _uid()
    data = request.get_json() or {}
    
    try:
        sub = SubscriptionService.update_subscription(sub_id, user_id, **data)
        return jsonify({"success": True, "item": to_dict(sub)})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 400


@bp.patch("/<int:sub_id>")
@jwt_required()
def patch_subscription(sub_id):
    """Partial update subscription"""
    return update_subscription(sub_id)


@bp.delete("/<int:sub_id>")
@jwt_required()
def delete_subscription(sub_id):
    """Xóa subscription"""
    user_id = _uid()
    
    try:
        SubscriptionService.delete_subscription(sub_id, user_id)
        return "", 204
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 400


# ---- API cho Dashboard/Charts ----

@bp.get("/stats/upcoming")
@jwt_required()
def get_upcoming_billings():
    """Lấy danh sách subscription sắp được thanh toán"""
    user_id = _uid()
    days = request.args.get("days", 30, type=int)
    
    subs = SubscriptionService.get_upcoming_billings(user_id, days)
    items = [to_dict(s) for s in subs]
    
    return jsonify({"items": items})


@bp.get("/stats/overview")
@jwt_required()
def get_overview():
    """Lấy thông tin tổng quan về subscription"""
    user_id = _uid()
    
    active_subs = SubscriptionService.get_user_subscriptions(user_id, "active")
    paused_subs = SubscriptionService.get_user_subscriptions(user_id, "paused")
    cancelled_subs = SubscriptionService.get_user_subscriptions(user_id, "cancelled")
    
    monthly_cost = SubscriptionService.get_monthly_cost(user_id, "active")
    category_stats = SubscriptionService.get_category_stats(user_id, "active")
    
    return jsonify({
        "stats": {
            "active_count": len(active_subs),
            "paused_count": len(paused_subs),
            "cancelled_count": len(cancelled_subs),
            "monthly_cost": monthly_cost,
            "yearly_cost": monthly_cost * 12,
            "category_breakdown": category_stats,
        }
    })


@bp.get("/stats/calendar")
@jwt_required()
def get_calendar_events():
    """Lấy dữ liệu cho calendar view - khi nào có thanh toán"""
    user_id = _uid()
    
    subs = SubscriptionService.get_user_subscriptions(user_id, "active")
    events = []
    
    for sub in subs:
        events.append({
            "id": sub.id,
            "title": f"{sub.name} (-{sub.price:,} VND)",
            "start": sub.next_billing_date.isoformat(),
            "color": _get_category_color(sub.category),
            "price": sub.price,
            "category": sub.category,
        })
    
    return jsonify({"events": events})


def _get_category_color(category: str) -> str:
    """Assign color based on category"""
    colors = {
        "Entertainment": "#dc3545",
        "Work": "#0d6efd",
        "Productivity": "#198754",
        "Streaming": "#fd7e14",
        "Education": "#6f42c1",
        "Other": "#6c757d",
    }
    return colors.get(category, "#6c757d")
