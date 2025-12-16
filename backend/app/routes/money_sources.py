"""
Money Source API Routes - REST endpoints for managing fund sources
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.money_source_service import MoneySourceService
from app.models.money_source import MoneySource

money_sources_bp = Blueprint("money_sources", __name__, url_prefix="/api/money-sources")


@money_sources_bp.route("", methods=["GET"])
@jwt_required()
def get_money_sources():
    """Get all money sources for current user"""
    user_id = get_jwt_identity()

    active_only = request.args.get("active_only", "true").lower() == "true"
    sources = MoneySourceService.get_all_money_sources(user_id, active_only=active_only)

    return (
        jsonify(
            {
                "items": [s.to_dict() for s in sources],
                "stats": MoneySourceService.get_money_source_stats(user_id),
            }
        ),
        200,
    )


@money_sources_bp.route("/<int:source_id>", methods=["GET"])
@jwt_required()
def get_money_source(source_id):
    """Get a specific money source"""
    user_id = get_jwt_identity()
    source = MoneySourceService.get_money_source(source_id, user_id)

    if not source:
        return jsonify({"message": "Money source not found"}), 404

    return jsonify(source.to_dict()), 200


@money_sources_bp.route("", methods=["POST"])
@jwt_required()
def create_money_source():
    """Create a new money source"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    # Validation
    if not data.get("name"):
        return jsonify({"message": "Name is required"}), 400
    if not data.get("type"):
        return jsonify({"message": "Type is required"}), 400

    balance = float(data.get("balance", 0))
    if balance < 0:
        return jsonify({"message": "Balance cannot be negative"}), 400

    # Create
    source = MoneySourceService.create_money_source(
        user_id=user_id,
        name=data["name"],
        type=data["type"],
        balance=balance,
        description=data.get("description"),
    )

    return jsonify(source.to_dict()), 201


@money_sources_bp.route("/<int:source_id>", methods=["PUT"])
@jwt_required()
def update_money_source(source_id):
    """Update a money source"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    # Check if exists
    source = MoneySourceService.get_money_source(source_id, user_id)
    if not source:
        return jsonify({"message": "Money source not found"}), 404

    # Validate balance if provided
    if "balance" in data:
        balance = float(data["balance"])
        if balance < 0:
            return jsonify({"message": "Balance cannot be negative"}), 400

    # Update
    updated = MoneySourceService.update_money_source(source_id, user_id, **data)

    return jsonify(updated.to_dict()), 200


@money_sources_bp.route("/<int:source_id>", methods=["DELETE"])
@jwt_required()
def delete_money_source(source_id):
    """Delete a money source"""
    user_id = get_jwt_identity()

    deleted = MoneySourceService.delete_money_source(source_id, user_id)
    if not deleted:
        return jsonify({"message": "Money source not found"}), 404

    return jsonify({"message": "Deleted successfully"}), 200


@money_sources_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    """Get money source statistics"""
    user_id = get_jwt_identity()
    stats = MoneySourceService.get_money_source_stats(user_id)

    return jsonify(stats), 200


@money_sources_bp.route("/<int:source_id>/adjust", methods=["POST"])
@jwt_required()
def adjust_balance(source_id):
    """Adjust balance of a money source"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    amount = float(data.get("amount", 0))

    source = MoneySourceService.adjust_balance(source_id, user_id, amount)
    if not source:
        return jsonify({"message": "Money source not found"}), 404

    return jsonify(source.to_dict()), 200
