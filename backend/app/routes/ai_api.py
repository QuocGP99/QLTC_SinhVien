# backend/app/routes/ai_api.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime

from ..extensions import db
from ..models.expense import Expense
from ..models.income import Income
from ..models.category import Category

from ..ai.chat_pipeline import process_chat_message
from ..ai.nlp_rules import extract_amount_vnd, detect_tx_type


bp = Blueprint("ai_api", __name__, url_prefix="/api/ai")

def _uid():
    from flask_jwt_extended import get_jwt_identity
    return get_jwt_identity()


def find_or_default_category(name: str, tx_type: str, user_id: int | None) -> Category | None:
    """
    Tìm category theo tên gần đúng; nếu không có thì fallback 'Khác' hoặc None
    Tùy logic: bạn có thể thêm filter theo user_id nếu category là per-user.
    """
    q = Category.query

    # nếu bạn có field type = 'expense'/'income' thì filter thêm
    if hasattr(Category, "type"):
        q = q.filter(Category.type == tx_type)

    cat = q.filter(Category.name.ilike(f"%{name}%")).first()
    if cat:
        return cat

    # fallback 'Khác'
    other = q.filter(Category.name.ilike("%khác%")).first()
    return other


@bp.post("/create_transaction")
@jwt_required()
def create_transaction():
    user_id = _uid()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Missing 'text'"}), 400

    parsed = parse_text_to_transaction(text)

    amount = parsed.get("amount")
    if not amount or amount <= 0:
        return jsonify({
            "error": "Không tìm được số tiền hợp lệ trong câu nhập. Vui lòng nhập rõ số tiền.",
            "parsed": parsed
        }), 400

    tx_type = parsed["type"]  # 'income' | 'expense'
    category_name = parsed["category_name"]
    note = parsed["note"]

    # Tìm category trong DB
    category = find_or_default_category(category_name, tx_type, user_id)
    category_id = category.id if category else None
    category_display = category.name if category else category_name

    now = datetime.utcnow()

    if tx_type == "expense":
        tx = Expense(
            user_id=user_id,
            amount=amount,
            category_id=category_id,
            note=note,
            spent_at=now
        )
    else:
        tx = Income(
            user_id=user_id,
            amount=amount,
            category_id=category_id,
            note=note,
            received_at=now
        )

    db.session.add(tx)
    db.session.commit()

    money_str = f"{amount:,.0f} đ".replace(",", ".")

    msg_type = "chi tiêu" if tx_type == "expense" else "thu nhập"
    message = f"Đã lưu 1 giao dịch {msg_type} {money_str}"
    if category_display:
        message += f" - danh mục {category_display}"

    return jsonify({
        "status": "ok",
        "message": message,
        "data": {
            "id": tx.id,
            "type": tx_type,
            "amount": amount,
            "category_id": category_id,
            "category_name": category_display,
            "note": note
        }
    }), 201

#Phân loại giao dịch
@bp.post("/classify")
@jwt_required()
def classify_text():
    data = request.get_json()
    text = data.get("text")

    from ..ai.classifier import predict_category

    category, prob = predict_category(text)

    return jsonify({
        "text": text,
        "category": category,
        "confidence": prob
    })

@bp.post("/chat")
@jwt_required()
def ai_chat():
    from ..ai.chat_pipeline import process_chat_message

    data = request.get_json()
    text = data.get("text")

    result = process_chat_message(text)

    return jsonify(result)
