import re
from datetime import datetime
from ...ai.nlp_rules import extract_amount_vnd
from ...ai.classifier import predict_category_all

CATEGORY_MAP = {
    5:  ["ăn", "uống", "food", "drink", "coffee", "cafe", "quán", "restaurant", "kfc", "lotteria"],
    6:  ["grab", "taxi", "bus", "vé xe", "gojek", "xăng", "petrol", "fuel"],
    7:  ["cgv", "galaxy", "cinema", "rap phim", "karaoke", "bowling", "vé xem phim"],
    8:  ["vinmart", "winmart", "bách hóa xanh", "circle k", "circlek", "ministop", "siêu thị", "supermarket"],
    9:  ["vpp", "văn phòng phẩm", "fahasa", "nhà sách", "book", "photo"],
    10: ["pharmacy", "thuốc", "guardian", "clinic", "bệnh viện"],
    11: ["tiền nhà", "nhà trọ", "internet", "wifi", "điện", "nước"],
}

PAYMENT_MAP = {
    1: ["tiền mặt", "cash"],
    2: ["credit", "visa", "master", "amex"],
    3: ["debit", "atm", "napas"],
    4: ["momo", "zalo", "zalopay", "vnpay", "airpay", "shopeepay"],
    5: ["chuyển khoản", "transfer", "banking", "qr", "scan"],
}

DATE_RE = re.compile(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})")

def map_category_id(text: str):
    low = text.lower()
    for cid, keywords in CATEGORY_MAP.items():
        for kw in keywords:
            if kw in low:
                return cid
    # fallback classifier
    cat, prob = predict_category_all(text)
    if prob >= 0.55:
        if "ăn" in cat: return 5
        if "siêu thị" in cat or "mua sắm" in cat: return 8
        if "giải trí" in cat: return 7
        if "di chuyển" in cat: return 6
    return 12   # Khác

def map_payment_id(text: str):
    low = text.lower()
    for pid, keywords in PAYMENT_MAP.items():
        for kw in keywords:
            if kw in low:
                return pid
    return 6

def parse_receipt(lines: list[str]):
    text = "\n".join(lines)
    amount = extract_amount_vnd(text)

    # date
    m = DATE_RE.search(text)
    date = None
    if m:
        raw = m.group(1)
        sep = "/" if "/" in raw else "-"
        d, mth, y = raw.split(sep)
        if len(y) == 2:
            y = "20" + y
        date = f"{int(d):02d}/{int(mth):02d}/{int(y)}"

    # store
    store = None
    for line in lines[:6]:
        if any(x in line.lower() for x in [
            "vinmart","winmart","bách hóa xanh","cgv","highland",
            "circle k","lotteria","kfc","ministop"
        ]):
            store = line
            break

    description = f"Chi tiêu tại {store}" if store else "Chi tiêu"
    category_id = map_category_id(text)
    payment_method_id = map_payment_id(text)

    return {
        "description": description,
        "amount": amount,
        "date": date,
        "category_id": category_id,
        "payment_method_id": payment_method_id,
        "raw_text": text,
    }
