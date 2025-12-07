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

def extract_saving_goal(text: str):
    """
    Trích xuất tên mục tiêu tiết kiệm + số tiền
    Ví dụ:
    - "tạo mục tiêu tiết kiệm mua xe máy SH 100 triệu"
    - "đặt mục tiêu tiết kiệm đi du lịch 3 triệu"
    - "tiết kiệm mua laptop 15 triệu"
    """

    raw = text.lower().strip()

    # -----------------------------
    # 1) TÁCH SỐ TIỀN
    # -----------------------------
    # Match dạng:
    #   100k
    #   3 triệu
    #   15 tr
    #   15000000
    money_match = re.search(r"(\d[\d\.]*)(\s*(k|nghìn|ngàn|ngan|tr|triệu|trieu))?", raw)

    amount = None
    if money_match:
        num = money_match.group(1).replace(".", "")
        unit = (money_match.group(3) or "").strip()

        try:
            value = float(num)
            if unit in ["k", "nghìn", "ngàn", "ngan"]:
                value *= 1000
            elif unit in ["tr", "triệu", "trieu"]:
                value *= 1_000_000
            elif value < 1000:
                # "50" hiểu 50k
                value *= 1000

            amount = int(value)
        except:
            amount = None

    # -----------------------------
    # 2) TÁCH TÊN MỤC TIÊU TIẾT KIỆM
    # -----------------------------
    # Tìm phần sau cụm: "mục tiêu tiết kiệm", "tiết kiệm"
    patterns = [
        r"mục tiêu tiết kiệm\s+(.*?)(\d|k|nghìn|ngàn|ngan|triệu|trieu|tr|$)",
        r"tiết kiệm\s+(.*?)(\d|k|nghìn|ngàn|ngan|triệu|trieu|tr|$)",
    ]

    goal_name = None
    for p in patterns:
        m = re.search(p, raw)
        if m:
            goal_name = m.group(1).strip()
            break

    # Nếu vẫn không tìm được tên → fallback
    if not goal_name:
        m2 = re.search(r"(mua|đi|du lịch|học phí|học tập|xe|laptop|macbook)\s+(.*)", raw)
        if m2:
            goal_name = raw.replace(money_match.group(0), "").strip()

    return {
        "goal_name": goal_name,
        "amount": amount,
    }


