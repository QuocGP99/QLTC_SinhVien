import re

INTENT_PATTERNS = {
    "income_transaction": [
    r"(nhận lương|lương|tiền lương)",
    r"(học bổng|hoc bong)",
    r"(mẹ gửi|ba gửi|bố gửi|bác gửi|anh gửi|chị gửi|người thân gửi|gia đình gửi)",
    r"(được.*\d+k|được.*\d+ triệu|được chuyển|được gửi)"
    r"(cho mình.*\d+k)",
    r"(cho mình.*\d+ triệu)",
    r"(nhận được)",
    r"(tiền thưởng|thưởng)",
    r"(bán|bán đồ|bán áo|bán quần|bán sách).*k"
    ],
    "set_budget": [
    r"(đặt|thiết lập|tạo).*(ngân sách)",
    r"(ngân sách).*(tháng này|tháng này|cho tháng)",
    r"(ngân sách)\s+\w+.*\d+[kK]?",
    ],

    "set_saving_goal": [
    r"\btạo mục tiêu tiết kiệm\b",
    r"\bđặt mục tiêu tiết kiệm\b",
    r"\btiết kiệm\b.*\b(mua|đi|đến|cho)\b.*\d",
    r"\bmục tiêu tiết kiệm\b.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*cho mục tiêu.*\d+[kK]?",
    r"(tiết kiệm).*mục tiêu.*\d+[kK]?",
    r"(tiết kiệm).*để.*\d+[kK]?",
    r"(tiết kiệm).*mua.*\d+[kK]?",
    r"(tiết kiệm).*đi.*\d+[kK]?",
    r"(tiết kiệm).*cho.*\d+[kK]?",
    r"(mục tiêu tiết kiệm).*\d+[kK]?",
    r"(tiết kiệm).*mục tiêu.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*để.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*mua.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*đi.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*cho.*(triệu|nghìn|ngàn|k|đ)",
    r"(mục tiêu tiết kiệm).*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*mục tiêu.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*để.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*mua.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*đi.*(triệu|nghìn|ngàn|k|đ)",
    r"(tiết kiệm).*cho.*(triệu|nghìn|ngàn|k|đ)",
    r"(mục tiêu tiết kiệm).*\d+[kK]?",
    ],


    "update_saving_goal": [
        r"(thêm|cộng).*tiết kiệm",
        r"(góp).*tiết kiệm",
    ],

    "ask_report": [
        r"(chi tiêu|chi tieu).*tháng",
        r"(xem báo cáo|bao cao|thống kê|thong ke).*",
        r"(chi tiêu).*([0-9]{1,2}\/[0-9]{4})",
        r"(chi tiêu ăn uống|di chuyển|mua sắm|học tập).*tháng",
        r"(tổng chi tiêu|tổng thu nhập).*"
    ],
    
    "ask_analysis": [
        r"(phân tích|phan tich|đánh giá|tư vấn).*chi tiêu",
        r"(mình tiêu nhiều quá phải không)",
        r"(chi tiêu tháng này ổn không)",
        r"(nên cắt giảm ở đâu)",
        r"(vượt ngân sách|vuot ngan sach)",
        r"(vượt budget|vuot budget)",
        r"(chi nhiều nhất|chi nhieu nhat)",
        r"(tốn nhất|ton nhat)",
        r"(mình tiêu nhiều vào đâu)",
        r"(danh mục nào nhiều nhất)"
    ],

    "add_transaction": [
        r"\b(mua|ăn|uống|nạp|đóng|grab|ship|mua sắm|mua đồ|trà sữa|coffee|cafe|mua hàng)\b",
        r"\b([0-9]+k)\b",
        r"\b([0-9]{4,6})(?!\/)\b",
    ],

    "search_transaction": [
        r"(tìm|search).*giao dịch",
        r"(tìm).*ăn uống|trà sữa|xăng|siêu thị",
    ],

    "delete_transaction": [
        r"(xóa|xoa).*giao dịch",
    ],
    "go_dashboard": [
        r"(dashboard|trang chủ|home|về trang chính)",
    ],
    "go_expense": [
        r"(chi tiêu|mở chi tiêu|tới chi tiêu|trang chi tiêu)",
    ],
    "go_income": [
        r"(thu nhập|xem thu nhập|trang thu nhập)",
    ],
    "go_budget": [
        r"(ngân sách|xem ngân sách|đến ngân sách)",
    ],
    "go_saving": [
        r"(tiết kiệm|mục tiêu tiết kiệm|trang tiết kiệm|đến tiết kiệm)",
    ],
    "go_analytics": [
        r"(phân tích|analytics|thống kê|trang phân tích|xem phân tích)",
    ],
    "small_talk": [
        r"(hello|xin chào|hi|chào bot)",
        r"(cảm ơn|thanks)",
    ],
    "ask_help": [
        r"(hướng dẫn|giúp mình|làm sao để|cách sử dụng)",
    ],
}

def detect_intent(text: str):
    text_lower = text.lower().strip()

    # ============================
    # CONFIRM YES (chỉ khi user trả lời ngắn)
    # ============================
    yes_words = ["đúng", "dung", "đồng ý", "dong y", "ok", "oke", "yes", "ừ", "uh"]
    if text_lower in yes_words:
        return "confirm_yes", {}

    # ============================
    # CONFIRM NO (chỉ khi trả lời ngắn)
    # ============================
    no_words = ["không", "ko", "k", "no", "không đồng ý"]
    if text_lower in no_words:
        return "confirm_no", {}

    # ============================
    # MATCH INTENT RULES
    # ============================
    for intent, patterns in INTENT_PATTERNS.items():
        for p in patterns:
            if re.search(p, text_lower):
                return intent, {}

    return "unknown", {}


    # =======================
    # CONFIRM NO
    # =======================
    no_words = ["không", "k", "ko", "khong", "no", "không đồng ý"]
    if any(w in text_lower for w in no_words):
        return "confirm_no", {}

    text_lower = text.lower()

    for intent, patterns in INTENT_PATTERNS.items():
        for p in patterns:
            if re.search(p, text_lower):
                return intent, {}

    return "unknown"
