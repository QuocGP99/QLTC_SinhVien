# backend/app/ai/nlp_rules.py
import re
from datetime import datetime


def extract_amount_vnd(text: str) -> int | None:
    if not text:
        return None

    s = text.lower().replace(",", "")  # Remove commas (Vietnamese thousands separator)

    # Loại bỏ các dòng chứa số điện thoại hoặc tài khoản
    s = re.sub(
        r"(sdt|điện thoại|dien thoai|phone|số điện|tài khoản|account)[\s:]*\d+", "", s
    )
    # Loại bỏ năm (2020-2030)
    s = re.sub(r"\b20\d{2}\b", "", s)
    s = re.sub(r"(tháng|thang|ngày|ngay)\s+\d+", "", s)

    # 1. Tìm từ khóa "tổng thành tiền", "tổng cộng", "thành tiền" → lấy số ngay sau đó
    total_pattern = r"(?:tổng\s*(?:thành\s*)?tiền|tổng\s*cộng|thành\s*tiền|thanh toan)[:\s]+(\d+)"
    total_match = re.search(total_pattern, s)
    if total_match:
        amount_str = total_match.group(1)
        try:
            amount = int(amount_str)
            if 1000 <= amount <= 500_000_000:  # Lọc giá trị hợp lý (1k - 500M)
                return amount
        except:
            pass

    # 2. Tìm pattern "số tiền: XXX"
    amount_pattern = r"(?:số tiền|amount|price)[:\s]+(\d+)"
    amount_match = re.search(amount_pattern, s)
    if amount_match:
        amount_str = amount_match.group(1)
        try:
            amount = int(amount_str)
            if 1000 <= amount <= 500_000_000:
                return amount
        except:
            pass

    # 3. Tìm pattern với đơn vị (k, triệu, tr, etc)
    pattern = r"(\d+(?:\.\d+)?)(?:\s*(k|nghìn|ngan|ngàn|tr|triệu|trieu))"
    matches = re.findall(pattern, s)

    if matches:
        values = []
        for num_str, unit in matches:
            try:
                value = float(num_str)
                if unit in ["k", "nghìn", "ngan", "ngàn"]:
                    value *= 1000
                elif unit in ["tr", "triệu", "trieu"]:
                    value *= 1_000_000
                amount = int(round(value))
                if 1000 <= amount <= 500_000_000:  # Lọc giá trị hợp lý
                    values.append(amount)
            except:
                pass
        if values:
            return max(values)

    # 4. Fallback: ưu tiên số 5-7 chữ số (62000) hơn 4 chữ số (2025)
    fallback_5digit = re.findall(r"\b(\d{5,7})\b", s)
    if fallback_5digit:
        nums = [int(x) for x in fallback_5digit]
        valid_amounts = [n for n in nums if 10_000 <= n <= 500_000_000]
        if valid_amounts:
            return max(valid_amounts)

    # 5. Nếu không tìm được 5-7 chữ số, thử 4 chữ số (bỏ qua năm)
    fallback_4digit = re.findall(r"\b(\d{4})\b", s)
    if fallback_4digit:
        nums = [int(x) for x in fallback_4digit]
        # Bỏ qua năm (2000-2030) và số quá nhỏ
        valid_amounts = [
            n for n in nums if (n < 2000 or n > 2030) and 1000 <= n <= 50_000_000
        ]
        if valid_amounts:
            return max(valid_amounts)

    return None


def detect_tx_type(text: str) -> str:
    """
    Xác định loại giao dịch: income hoặc expense
    """
    s = (text or "").lower()

    income_keywords = [
        "lương",
        "luong",
        "nhận lương",
        "nhan luong",
        "học bổng",
        "hoc bong",
        "được chuyển",
        "duoc chuyen",
        "gửi tiền",
        "gui tien",
        "ba gửi",
        "bo gui",
        "bố gửi",
        "mẹ gửi",
        "me gui",
        "nhận tiền",
        "nhan tien",
        "trợ cấp",
        "tro cap",
        "tiền thưởng",
        "thuong",
        "bonus",
    ]

    expense_keywords = [
        "ăn",
        "uong",
        "uống",
        "mua",
        "trả",
        "tra ",
        "đóng",
        "dong",
        "tiền xăng",
        "xăng",
        "xang",
        "cà phê",
        "cafe",
        "coffee",
        "nhậu",
        "karaoke",
        "đi chơi",
        "vé xe",
        "grab",
        "taxi",
        "photo",
        "sách",
        "sach",
        "siêu thị",
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
        m2 = re.search(
            r"(mua|đi|du lịch|học phí|học tập|xe|laptop|macbook)\s+(.*)", raw
        )
        if m2:
            goal_name = raw.replace(money_match.group(0), "").strip()

    return {
        "goal_name": goal_name,
        "amount": amount,
    }
