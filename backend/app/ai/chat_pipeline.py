# backend/app/ai/chat_pipeline.py



import os
import re
import json
import requests

from datetime import date
from ..models.expense import Expense
from ..models.budget import Budget
from ..models.category import Category
from ..extensions import db
from sqlalchemy import func

LAST_INTENT = {}

from .classifier import predict_category_all
from .nlp_rules import extract_amount_vnd, detect_tx_type, extract_saving_goal
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

def get_budget_status(user_id):
    today = date.today()
    month = today.month
    year = today.year

    # tổng chi tháng
    spent = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user_id,
            Expense.spent_at >= date(year, month, 1),
            Expense.spent_at <= today,
        )
        .scalar()
    )

    # tổng ngân sách tháng
    budget = (
        db.session.query(func.coalesce(func.sum(Budget.limit_amount), 0))
        .filter(
            Budget.user_id == user_id,
            Budget.period_year == year,
            Budget.period_month == month,
        )
        .scalar()
    )

    return float(spent), float(budget)


def get_top_spending_category(user_id):
    today = date.today()
    month = today.month
    year = today.year

    row = (
        db.session.query(
            Category.name,
            func.sum(Expense.amount).label("total")
        )
        .join(Category, Category.id == Expense.category_id)
        .filter(
            Expense.user_id == user_id,
            Expense.spent_at >= date(year, month, 1),
            Expense.spent_at <= today,
            Category.type == "expense"
        )
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
        .first()
    )

    if row:
        return row.name, float(row.total)
    return None, 0.0

# ======================================================
# MAIN PROCESSOR
# ======================================================
def process_chat_message(user_id, user_message):
    """
    TRÌNH XỬ LÝ CHÍNH CHO CHATBOT
    - Bắt intent
    - Phân tích NLP
    - Phân loại ML
    - Nếu intent unknown → gọi AI (GROQ)
    """
    original_text = user_message.strip()
    text = clean_text(original_text)

    intent, info = detect_intent(original_text)

    if intent in ["confirm_yes", "confirm_no"]:
        return {
            "intent": intent,
            "message": intent  # trả về đơn giản cho FE xử lý
        }

    global LAST_INTENT
    # Lưu intent hiện tại để xử lý follow-up
    LAST_INTENT[user_id] = intent

    # Nếu câu trước là ask_report → ép follow-up về ask_report
    if LAST_INTENT.get(user_id) == "ask_report" and intent == "unknown":
        intent = "ask_report"


    # =====================================================
    # 1. SET BUDGET
    # =====================================================
    if intent == "set_budget":
        t = text.lower()
        amount = extract_amount_vnd(text)

        # ===== RULE: Nhận diện danh mục ngân sách =====
        if "ăn uống" in t or "an uong" in t:
            budget_category = "Ăn uống"

        elif "di chuyển" in t or "di chuyen" in t:
            budget_category = "Di chuyển"

        elif "học tập" in t or "hoc tap" in t or "sách vở" in t:
            budget_category = "Học tập"

        elif "xem phim" in t or "giải trí" in t:
            budget_category = "Giải trí"

        elif "nhà ở" in t or "nha o" in t or "phòng trọ" in t \
            or "phong tro" in t or "tiền phòng" in t or "tien phong" in t \
            or "thuê phòng" in t or "thue phong" in t:
            budget_category = "Nhà ở"

        else:
            budget_category = "Khác (expense)"

        category_id = CATEGORY_MAP.get(budget_category, 12)

        # ===== RULE: Nếu câu có từ "thêm / tăng / cộng" thì hiểu là tăng ngân sách =====
        is_increment = any(kw in t for kw in ["thêm", "them", "tăng", "tang", "cộng", "cong"])

        # Câu xác nhận tự nhiên hơn
        if is_increment:
            msg = f"Bạn muốn tăng ngân sách {budget_category} thêm {amount:,}đ phải không?"
        else:
            msg = f"Bạn muốn đặt ngân sách {budget_category} = {amount:,}đ cho tháng này đúng không?"

        return {
            "intent": "set_budget",
            "budget_category": budget_category,
            "category_id": category_id,
            "amount": amount,
            "increment": is_increment,
            "confirm": True,
            "message": msg,
            "note": original_text
        }
    
    # ==========================================
    #  SAVING: TẠO MỤC TIÊU
    # ==========================================
    if intent == "set_saving_goal":
        parsed = extract_saving_goal(original_text)
        goal_name = parsed.get("goal_name")
        amount = parsed.get("amount")

        from ..models.saving import SavingsGoal

        existing = SavingsGoal.query.filter_by(
            user_id=user_id,
            name=goal_name
        ).first()

        # Trường hợp tạo mới
        if not existing:
            return {
                "intent": "set_saving_goal",
                "confirm": True,
                "goal_name": goal_name,
                "amount": amount,
                "message": f"Bạn muốn tạo mục tiêu tiết kiệm '{goal_name}' với số tiền {amount:,.0f}đ đúng không?"
            }

        # Trường hợp mục tiêu đã tồn tại → hỏi góp thêm
        return {
            "intent": "update_saving_goal",
            "confirm": True,
            "goal_id": existing.id,
            "goal_name": goal_name,
            "amount": amount,
            "message": f"Mục tiêu '{goal_name}' đã tồn tại. Bạn muốn góp thêm {amount:,.0f}đ không?"
        }

    # ==========================================
    #  SAVING: GÓP THÊM TIỀN
    # ==========================================
    if intent == "update_saving_goal":
        parsed = extract_saving_goal(original_text)
        goal_name = parsed.get("goal_name")
        amount = parsed.get("amount")

        from ..models.saving import SavingsGoal

        existing = SavingsGoal.query.filter_by(
            user_id=user_id,
            name=goal_name
        ).first()

        if not existing:
            return {
                "intent": "unknown",
                "message": "Mình không tìm thấy mục tiêu này, bạn muốn tạo mới không?"
            }

        return {
            "intent": "update_saving_goal",
            "confirm": True,
            "goal_id": existing.id,
            "goal_name": goal_name,
            "amount": amount,
            "message": f"Bạn muốn góp thêm {amount:,.0f}đ vào mục tiêu '{goal_name}' phải không?"
        }



    # =====================================================
    # 4. INCOME TRANSACTION (ưu tiên hơn add_transaction)
    # =====================================================
    if intent == "income_transaction":
        amount = extract_amount_vnd(text)
        t = text.lower()

        if "lương" in t or "luong" in t:
            income_category = "Lương"
        elif "học bổng" in t or "hoc bong" in t:
            income_category = "Học bổng"
        else:
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

    # =====================================================
    # 5. ADD TRANSACTION — xử lý cuối cùng
    # =====================================================
    if intent == "add_transaction":
        amount = extract_amount_vnd(text)
        tx_type = detect_tx_type(text)

        ai_list = predict_category_all(text)
        ai_category = ai_list[0]["label"] if ai_list else "Khác (expense)"
        ai_category = fix_category_by_rules(text, ai_category)
        category_id = CATEGORY_MAP.get(ai_category)
        confidence = ai_list[0]["prob"] if ai_list else 0.7

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

        
    # =====================================================
    # 6. ASK REPORT (phân tích thống kê tài chính)
    # =====================================================
    if intent == "ask_report":
        t = text.lower()

        # Nhận follow-up: tổng cộng trong tháng nào?
        # Nếu chỉ hỏi chung
        if "bao nhiêu" in t or "tổng cộng" in t or "tong cong" in t:
            return {
                "intent": "ask_report",
                "message": "Bạn muốn xem theo ngày cụ thể hay tổng cộng?"
            }

        # Nếu người dùng trả lời muốn xem tổng cộng tháng cụ thể
        # Ví dụ "tháng 12/2025" hoặc "tháng 11"
        month_year = re.findall(r"tháng\s*(\d{1,2})(?:/(\d{4}))?", original_text.lower())

        if month_year:
            month = int(month_year[0][0])
            year = int(month_year[0][1]) if month_year[0][1] else 2025

            # Bạn có thể query database tại đây (gọi API real)
            # Hiện tại trả kết quả mô phỏng
            # ------------------------------------------------
            return {
                "intent": "ask_report",
                "analysis": f"Chi tiêu của bạn trong tháng {month}/{year} là 320.000đ.",
                "message": f"Mình đã tổng hợp chi tiêu theo danh mục cho tháng {month}/{year}."
            }

        # fallback
        return {
            "intent": "ask_report",
            "message": "Bạn muốn xem chi tiêu tháng mấy hoặc danh mục nào?"
        }

    # =====================================================
    # 6. NAVIGATION
    # =====================================================
    if intent.startswith("go_"):
        mapping = {
            "go_dashboard": "/",
            "go_expense": "/transactions/expenses",
            "go_income": "/transactions/income",
            "go_budget": "/budgets",
            "go_saving": "/savings",
            "go_analytics": "/analytics",
        }

        return {
            "intent": "navigate",
            "action": "redirect",
            "to": mapping.get(intent)
        }

    # =====================================================
# 7. ASK ANALYSIS (Qwen 2.5 phân tích tài chính)
# =====================================================
    if intent == "ask_analysis":
        # 1) lấy dữ liệu thật
        spent, budget = get_budget_status(user_id)
        cat_name, cat_total = get_top_spending_category(user_id)

        # 2) chuẩn bị prompt gửi sang Qwen 2.5
        prompt = f"""
    Dữ liệu tháng này của người dùng:
    - Tổng chi tiêu: {spent} VND
    - Ngân sách: {budget} VND
    - Danh mục chi nhiều nhất: {cat_name} ({cat_total} VND)

    Câu hỏi của người dùng: "{user_message}"

    Hãy trả lời NGẮN GỌN theo format JSON:
    {{
    "analysis": "...",
    "message": "..."
    }}
    Không dùng markdown.
    """

        # 3) gọi Qwen (dùng API Ollama hoặc Huggingface tùy bạn)
        from .qwen_client import call_qwen
        ai_res = call_qwen(prompt)

        # nếu Qwen fail → fallback
        if not isinstance(ai_res, dict):
            ai_res = {
                "analysis": "Không thể phân tích bằng AI.",
                "message": "Bạn thử hỏi lại giúp mình nha."
            }

        # 4) trả lại JSON cho FE (chat UI)
        return ai_res

    
