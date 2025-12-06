# backend/app/ai/nlp_rules.py
import re
from datetime import datetime

def extract_amount_vnd(text: str) -> int | None:
    if not text:
        return None

    s = text.lower().replace(",", ".")
    
    s = re.sub(r"(tháng|thang|ngày|ngay)\s+\d+", "", s)

    pattern = r'(\d+(?:\.\d+)?)(?:\s*(k|nghìn|ngan|ngàn|tr|triệu|trieu))'
    matches = re.findall(pattern, s)

    if matches:
        values = []
        for num_str, unit in matches:
            value = float(num_str)
            if unit in ["k", "nghìn", "ngan", "ngàn"]:
                value *= 1000
            elif unit in ["tr", "triệu", "trieu"]:
                value *= 1_000_000
            values.append(int(round(value)))
        return max(values)

    fallback = re.findall(r'\b\d+(?:\.\d+)?\b', s)
    if fallback:
        nums = [float(x) for x in fallback]
        biggest = max(nums)
        if biggest < 1000:
            biggest *= 1000
        return int(round(biggest))

    return None


def detect_tx_type(text: str) -> str:
    """
    Xác định loại giao dịch: income hoặc expense
    """
    s = (text or "").lower()

    income_keywords = [
        "lương", "luong", "nhận lương", "nhan luong",
        "học bổng", "hoc bong",
        "được chuyển", "duoc chuyen",
        "gửi tiền", "gui tien",
        "ba gửi", "bo gui", "bố gửi",
        "mẹ gửi", "me gui",
        "nhận tiền", "nhan tien",
        "trợ cấp", "tro cap",
        "tiền thưởng", "thuong", "bonus"
    ]

    expense_keywords = [
        "ăn", "uong", "uống", "mua", "trả", "tra ", "đóng", "dong",
        "tiền xăng", "xăng", "xang",
        "cà phê", "cafe", "coffee",
        "nhậu", "karaoke", "đi chơi",
        "vé xe", "grab", "taxi",
        "photo", "sách", "sach", "siêu thị"
    ]

    # ƯU TIÊN income
    if any(k in s for k in income_keywords):
        return "income"

    if any(k in s for k in expense_keywords):
        return "expense"

    if "nhận" in s or "nhan" in s:
        return "income"

    return "expense"
