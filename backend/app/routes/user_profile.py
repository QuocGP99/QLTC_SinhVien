from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models.user import User
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

bp = Blueprint("user", __name__, url_prefix="/api/user")

# Cấu hình upload
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "../../uploads/avatars")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Tạo folder nếu chưa tồn tại
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route("/upload-avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    """Upload ảnh đại diện cho user"""
    try:
        user_id = get_jwt_identity()
        logger.info(f"Upload avatar for user_id: {user_id}")

        user = db.session.get(User, user_id)

        if not user:
            logger.warning(f"User not found: {user_id}")
            return jsonify({"success": False, "message": "User not found"}), 404

        # Kiểm tra file
        if "avatarFile" not in request.files:
            logger.warning("No avatarFile in request.files")
            return jsonify({"success": False, "message": "No file part"}), 400

        file = request.files["avatarFile"]

        if file.filename == "":
            return jsonify({"success": False, "message": "No selected file"}), 400

        # Kiểm tra kích thước file
        if len(file.read()) > MAX_FILE_SIZE:
            file.seek(0)
            return (
                jsonify({"success": False, "message": "File too large (max 5MB)"}),
                400,
            )

        file.seek(0)

        # Kiểm tra extension
        if not allowed_file(file.filename):
            return jsonify({"success": False, "message": "File type not allowed"}), 400

        # Tạo tên file an toàn
        ext = file.filename.rsplit(".", 1)[1].lower()
        filename = f"user_{user_id}_{datetime.utcnow().timestamp()}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        # Lưu file
        file.save(filepath)
        logger.info(f"File saved to: {filepath}")

        # Cập nhật avatar URL (đường dẫn tương đối)
        avatar_url = f"/uploads/avatars/{filename}"
        user.avatar = avatar_url

        # Cập nhật full_name nếu được gửi
        full_name = request.form.get("fullName")
        if full_name:
            user.full_name = full_name
            logger.info(f"Updated full_name to: {full_name}")

        db.session.commit()
        logger.info(f"Avatar updated successfully for user {user_id}")

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Avatar uploaded successfully",
                    "avatar_url": avatar_url,
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error uploading avatar: {str(e)}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500


@bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    """Lấy thông tin profile của user hiện tại"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        return (
            jsonify(
                {
                    "success": True,
                    "data": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                        "avatar": user.avatar,
                        "role": user.role,
                        "is_verified": user.is_verified,
                        "created_at": (
                            user.created_at.isoformat() if user.created_at else None
                        ),
                    },
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """Cập nhật thông tin profile của user"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        data = request.get_json() or {}

        # Cập nhật full_name
        if "full_name" in data:
            user.full_name = data["full_name"]

        db.session.commit()

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Profile updated successfully",
                    "data": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                        "avatar": user.avatar,
                    },
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# Endpoint test token (không cần auth)
@bp.route("/test-token", methods=["POST"])
def test_token():
    """Test token - gỡ lỗi"""
    auth_header = request.headers.get("Authorization", "")
    logger.info(f"Authorization header: {auth_header}")

    if not auth_header:
        return jsonify({"success": False, "message": "No Authorization header"}), 400

    if not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "message": "Invalid token format"}), 400

    token = auth_header[7:]  # Remove "Bearer "
    logger.info(f"Token length: {len(token)}")

    return (
        jsonify(
            {"success": True, "message": "Token received", "token_length": len(token)}
        ),
        200,
    )
