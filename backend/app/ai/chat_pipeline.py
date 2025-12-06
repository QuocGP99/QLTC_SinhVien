# backend/app/ai/chat_pipeline.py

import os
import re
import json
import requests

from .classifier import predict_category_all
from .nlp_rules import extract_amount_vnd, detect_tx_type
from .chatbot_intent import detect_intent


# ======================================================
# CATEGORY MAP theo DB dự án của bạn
# ======================================================
CATEGORY_MAP = {
    "Lương": 1,
    "Học bổng": 2,
    "Thưởng": 3,
    "Khác (income)": 4,
    "Ăn uống": 5,
    "Di chuyển": 6,
    "Giải trí": 7,
    "Mua sắm": 8,
    "Học tập": 9,
    "Sức khỏe": 10,
    "Nhà ở": 11,
    "Khác (expense)": 12
}


# ======================================================
# HỆ THỐNG AI (GROQ)
# ======================================================
SYSTEM_GROQ = """
Bạn là trợ lý tài chính thông minh của ứng dụng SVFinance dành cho sinh viên.

Nhiệm vụ của bạn:
---------------------------------
1) TRẢ LỜI DƯỚI DẠNG JSON HOÀN TOÀN HỢP LỆ:
   - Nếu chỉ cần trả lời bình thường → dùng:
     {"message": "<nội dung>"}

   - Nếu phân tích tài chính → dùng:
     {"analysis": "<nhận xét>", "message": "<nội dung>"}

   - Nếu điều hướng trang web → dùng:
     {"action": "redirect", "to": "<route>"}

    KHÔNG BAO GIỜ trả JSON sai cấu trúc.
    KHÔNG BAO GIỜ tự tạo số tiền, danh mục, hoặc confirm giao dịch.
    KHÔNG BAO GIỜ trả về mảng, object thừa, hoặc các key không hợp lệ.
    KHÔNG dùng markdown, không trả code block.

---------------------------------
2) DANH SÁCH CÁC ROUTE HỢP LỆ TRONG ỨNG DỤNG:
   - Trang chủ:            /
   - Quản lý giao dịch:    /transactions
   - Chi tiêu:             /transactions/expenses
   - Thu nhập:             /transactions/income
   - Ngân sách:            /budgets
   - Tiết kiệm:            /savings
   - Phân tích tài chính:  /analytics
   - Cài đặt:              /settings

Các hành động điều hướng:
   "to": "/transactions/expenses"
   "to": "/transactions/income"
   "to": "/budgets"
   "to": "/savings"
   "to": "/analytics"
    "to": "/settings"

---------------------------------
3) QUY TẮC XỬ LÝ TIN NHẮN:
   - KHÔNG phân loại giao dịch. Backend đã làm qua NLP + ML.
   - KHÔNG suy đoán số tiền từ câu nói của người dùng.
   - KHÔNG tự thêm giao dịch hoặc mục tiêu tiết kiệm.
   - KHÔNG tự infer category.

Bạn chỉ thực hiện:
   (a) Trả lời câu hỏi
   (b) Phân tích dữ liệu theo nội dung người dùng muốn xem
   (c) Điều hướng trang
   (d) Gợi ý, giải thích, tư vấn tài chính

---------------------------------
4) VÍ DỤ ĐẦU RA ĐÚNG:
   Người dùng: "Mở trang chi tiêu"
   → Trả về:
     {"action": "redirect", "to": "/transactions/expenses"}

   Người dùng: "Tháng này mình tiêu nhiều không?"
   → Trả về:
     {
       "analysis": "Bạn đã chi tiêu nhiều vào ăn uống và di chuyển.",
       "message": "Mình sẽ giúp bạn xem biểu đồ chi tiêu ở trang phân tích."
     }

   Người dùng: "Tổng kết chi tiêu của tháng này giúp mình."
   → Trả về:
     {"message": "Bạn muốn xem theo danh mục hay theo từng tuần?"}

---------------------------------
5) VĂN PHONG TRẢ LỜI:
   - Ngắn gọn, thực tế, thân thiện.
   - Không quá dài dòng.
   - Dùng ngôi xưng “mình – bạn”.
   - Nội dung phù hợp sinh viên Việt Nam.

---------------------------------
6) NẾU KHÔNG CHẮC Ý NGƯỜI DÙNG:
   → Hỏi lại để làm rõ nhu cầu.
   Ví dụ:
     {"message": "Bạn muốn xem chi tiêu tháng mấy và danh mục nào?"}

---------------------------------

Bạn đã sẵn sàng. Hãy luôn trả lời theo đúng JSON yêu cầu.

"""

def call_groq(user_message: str):
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        return {"message": "Thiếu GROQ_API_KEY trong .env"}

    url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",  # FREE + rất nhanh
        "messages": [
            {"role": "system", "content": SYSTEM_GROQ},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.2
    }

    try:
        r = requests.post(url, json=payload, headers=headers)
        data = r.json()

        # Nếu API trả lỗi
        if "error" in data:
            return {"message": f"AI lỗi: {data['error']}"}

        if "choices" not in data:
            return {"message": f"Kết quả không hợp lệ: {data}"}

        raw = data["choices"][0]["message"]["content"]

        # Nếu AI trả JSON: parse
        try:
            return json.loads(raw)
        except:
            # Nếu trả text: đưa vào message
            return {"message": raw}

    except Exception as e:
        return {"message": f"Lỗi AI nội bộ: {e}"}


# ======================================================
# Utility
# ======================================================
def clean_text(s: str):
    return s.strip().lower() if s else ""

#update 
def fix_category_by_rules(text, ai_category):
    t = text.lower()

        # --- THU NHẬP ---
    if any(k in t for k in ["gửi", "gui", "nhận", "nhan", "học bổng", "hoc bong"]):
        return "Khác (income)"
    if any(k in t for k in ["lương", "luong", "thưởng", "thuong"]):
        return "Lương"

    # --- mua sắm ---
    if any(k in t for k in ["siêu thị", "sieu thi", "mua đồ", "mua do", "shopee", "tiki"]):
        return "Mua sắm"

    # --- hóa đơn điện / nước ---
    if any(k in t for k in ["tiền điện", "tien dien", "điện", "dien", "nước", "nuoc"]):
        return "Khác (expense)"

    # --- phòng trọ / nhà ở ---
    if any(k in t for k in ["tiền phòng", "tien phong", "phòng trọ", "phong tro", "tiền nhà", "tien nha"]):
        return "Nhà ở"

    return ai_category


# ======================================================
# MAIN PROCESSOR
# ======================================================
def process_chat_message(text: str):
    """
    TRÌNH XỬ LÝ CHÍNH CHO CHATBOT
    - Bắt intent
    - Phân tích NLP
    - Phân loại ML
    - Nếu intent unknown → gọi AI (GROQ)
    """
    original_text = text
    text = clean_text(text)

    intent = detect_intent(text)

    # ----------------------------------------------------
    # 1. ADD TRANSACTION
    # ----------------------------------------------------
    if intent == "add_transaction":
        amount = extract_amount_vnd(text)
        tx_type = detect_tx_type(text)

        ai_list = predict_category_all(text)
        ai_category = ai_list[0]["label"] if ai_list else "Khác (expense)"
        ai_category = fix_category_by_rules(text, ai_category)
        category_id = CATEGORY_MAP.get(ai_category)

        confidence = ai_list[0]["prob"] if ai_list else 0.7

        # ƯU TIÊN học bổng
        if "học bổng" in text or "hoc bong" in text:
            ai_category = "Học bổng"
            category_id = 2
        else:
            category_id = CATEGORY_MAP.get(ai_category)

        return {
            "intent": "add_transaction",
            "type": tx_type,
            "amount": amount,
            "category": ai_category,
            "category_id": category_id,
            "confidence": confidence,
            "note": original_text,
            "confirm": True
        }
        # ----------------------------------------------------
    # 1B. INCOME TRANSACTION (ưu tiên cao hơn add_transaction)
    # ----------------------------------------------------
    if intent == "income_transaction":
        amount = extract_amount_vnd(text)
        t = text.lower()

        # RULE phân loại thu nhập
        if any(k in t for k in ["lương", "luong", "nhận lương", "nhan luong"]):
            income_category = "Lương"
        elif any(k in t for k in ["học bổng", "hoc bong"]):
            income_category = "Học bổng"
        else:
            # mặc định các câu như "mẹ gửi", "bác gửi", "bán áo"
            income_category = "Khác (income)"

        return {
            "intent": "add_transaction",
            "type": "income",
            "amount": amount,
            "category": income_category,
            "category_id": CATEGORY_MAP.get(income_category),
            "confidence": 1.0,
            "note": original_text,
            "confirm": True
        }

        # ----------------------------------------------------
    # 2. SET BUDGET
    # ----------------------------------------------------
    if intent == "set_budget":
        amount = extract_amount_vnd(text)
        t = text.lower()

        # RULE: Tìm danh mục ngân sách theo từ khóa
        if "ăn uống" in t or "an uong" in t:
            budget_category = "Ăn uống"
        elif "di chuyển" in t or "di chuyen" in t:
            budget_category = "Di chuyển"
        elif "học tập" in t or "hoc tap" in t:
            budget_category = "Học tập"
        elif "xem phim" in t:
            budget_category = "Giải trí"
        else:
            budget_category = "Khác (expense)"

        return {
            "intent": "set_budget",
            "budget_category": budget_category,
            "category_id": CATEGORY_MAP.get(budget_category),
            "amount": amount,
            "note": original_text,
            "confirm": True
        }

    # ----------------------------------------------------
    # 3. SET SAVING GOAL
    # ----------------------------------------------------
    if intent == "set_saving_goal":
        amount = extract_amount_vnd(text)
        return {
            "intent": "set_saving_goal",
            "amount": amount,
            "goal_name": original_text,
            "confirm": True
        }

    # ----------------------------------------------------
    # 4. NAVIGATION
    # ----------------------------------------------------
    if intent.startswith("go_"):
        mapping = {
    "go_dashboard": "/",
    "go_expense": "/transactions/expenses",
    "go_income": "/transactions/income",
    "go_budget": "/budgets",
    "go_saving": "/savings",
    "go_analytics": "/analytics"
}


        return {
            "intent": "navigate",
            "action": "redirect",
            "to": mapping.get(intent)
        }

    # ----------------------------------------------------
    # 5. GIẢI THÍCH BIỂU ĐỒ / CÂU PHỎNG VẤN
    # ----------------------------------------------------
    if intent == "ask_explain":
        return {
            "message": "Biểu đồ hiển thị phân bổ chi tiêu theo thời gian và danh mục."
        }

    # ----------------------------------------------------
    # 6. UNKNOWN → gọi GROQ AI
    # ----------------------------------------------------
    ai_res = call_groq(original_text)

    return ai_res
