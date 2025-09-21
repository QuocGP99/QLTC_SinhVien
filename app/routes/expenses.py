from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Expense, Category
from datetime import datetime

bp = Blueprint("expenses", __name__)

@bp.get("")
@jwt_required()
def list_expenses():
    uid = get_jwt_identity()
    q = Expense.query.filter_by(user_id=uid).order_by(Expense.date.desc(), Expense.id.desc())

    #loc theo category
    cat = request.args.get("category")
    if cat:
        q = q.join(Category).filter(Category.name == cat)

    #lọc theo date_from, date_to
    start_str = request.args.get("start")
    end_str = request.args.get("end")
    from datetime import datetime

    if start_str:
        try:
            end_date = datetime.fromisoformat(end_str)
            q = q.filter(Expense.date <= end_date)
        except Exception:
            return jsonify({"error": "end không hợp lệ, cần YYYY-MM-DD"}), 400
    
    #Sap xep moi truoc
    q = q.order_by(Expense.date.desc(), Expense.id.desc())

    #phan trang
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": [e.to_dict() for e in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total
    }), 200
    
@bp.post("")
@jwt_required()
def create_expense():
    uid = get_jwt_identity()
    data = request.get_json() or {}

    try:
        amount = float(data["amount"])
        date_str = data.get("date")
        note = data.get("note", "")
        payment_method = data.get("payment_method", "Tiền mặt")
        category_id = int(data["category_id"])
    except (KeyError, ValueError, TypeError) as e:
        return jsonify({"error": f"Thiếu hoặc sai dữ liệu: {str(e)}"}), 400

    # Parse date (nếu không có -> lấy now)
    try:
        if date_str:
            dt = datetime.fromisoformat(date_str)
        else:
            dt = datetime.now()
    except Exception:
        return jsonify({"error": "Ngày không hợp lệ, phải theo ISO 8601 (YYYY-MM-DDTHH:MM:SS)"}), 400

    # Kiểm tra category tồn tại
    category = Category.query.get(category_id)
    if not category:
        return jsonify({"error": "Category không tồn tại"}), 400

    e = Expense(
        user_id=uid,
        amount=amount,
        date=dt,
        note=note,
        payment_method=payment_method,
        category_id=category_id,
    )
    db.session.add(e)
    db.session.commit()

    return jsonify(e.to_dict()), 201

#get chi tiet chi tieu
@bp.get("/<int:expense_id>")
@jwt_required()
def get_expense(expense_id):
    uid = int(get_jwt_identity())
    e = Expense.query.filter_by(id=expense_id, user_id=uid).first()
    if not e:
        return jsonify({"error": "Không tìm thấy chi tiêu"}), 404
    return jsonify(e.to_dict()), 200

#edit expense
@bp.put("/<int:expense_id>")
@jwt_required()
def update_expense(expense_id):
    uid = int(get_jwt_identity())
    e = Expense.query.filter_by(id=expense_id, user_id=uid).first()
    if not e:
        return jsonify({"error": "Không tìm thấy chi tiêu"}), 404

    data = request.get_json() or {}

    # Cập nhật các trường có trong body
    if "amount" in data:
        try:
            e.amount = float(data["amount"])
        except ValueError:
            return jsonify({"error": "amount phải là số"}), 400

    if "date" in data:
        try:
            from datetime import datetime
            e.date = datetime.fromisoformat(data["date"])
        except Exception:
            return jsonify({"error": "date không hợp lệ, cần ISO 8601"}), 400

    if "note" in data:
        e.note = data["note"]

    if "payment_method" in data:
        e.payment_method = data["payment_method"]

    if "category_id" in data:
        from app.models import Category
        category = Category.query.get(data["category_id"])
        if not category:
            return jsonify({"error": "category_id không tồn tại"}), 400
        e.category_id = category.id

    db.session.commit()
    return jsonify(e.to_dict()), 200

@bp.delete("/<int:expense_id>")
@jwt_required()
def delete_expense(expense_id):
    uid = int(get_jwt_identity())
    e = Expense.query.filter_by(id=expense_id, user_id=uid).first()
    if not e:
        return jsonify({"error": "Không tìm thấy chi tiêu"}), 404

    db.session.delete(e)
    db.session.commit()
    # Có thể trả 204 No Content, hoặc 200 kèm id vừa xóa
    return jsonify({"deleted_id": expense_id}), 200


