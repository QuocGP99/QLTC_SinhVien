import pytest
from backend.app.ai.chat_pipeline import process_chat_message

def test_set_budget():
    user_id = 13
    cases = [
        ("Đặt ngân sách ăn uống 1 triệu tháng này", "set_budget"),
        ("Thiết lập ngân sách di chuyển 300k", "set_budget"),
        ("Ngân sách học tập 500k cho tháng này", "set_budget"),
        ("Đặt ngân sách 2 triệu cho ăn uống", "set_budget"),
        ("Ngân sách xem phim 200k", "set_budget"),
    ]

    results = []
    for text, expected in cases:
        result = process_chat_message(user_id, text)
        results.append((text, expected, result.get("intent")))

        assert result["intent"] == expected, f"FAIL: {text} → {result['intent']}"

    # Xuất kết quả ra file CSV
    with open("set_budget_results.csv", "w", encoding="utf-8-sig") as f:
        f.write("input,expected,detected\n")
        for inp, exp, det in results:
            f.write(f"\"{inp}\",{exp},{det}\n")
