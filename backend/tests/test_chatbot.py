import json
import requests
import pytest
import csv

API_URL = "http://127.0.0.1:5000/api/ai/chat"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2NDMzOTEzMSwianRpIjoiNzZlZGRhNTgtN2QzMi00N2FkLTgxODEtYmE2MzFiMDkzZDJjIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjEzIiwibmJmIjoxNzY0MzM5MTMxLCJleHAiOjE3NjQzNDI3MzEsInR5cCI6ImFjY2VzcyIsInJvbGUiOiJ1c2VyIn0.xiAgT_oeeGQ0-qy2aDflaCYWOFerjLHICfQtSWGwExg"   # Nếu cần, điền JWT token vào đây

# TẠO FILE CSV + HEADER
with open("chatbot_test_full.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f, delimiter=';')
    writer.writerow(["id", "input", "expected", "detected", "response"])

def write_log(case_id, input_text, expected, detected, response):
    with open("chatbot_test_full.csv", "a", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow([
            case_id,
            input_text,
            expected,
            detected,
            json.dumps(response, ensure_ascii=False)
        ])


def call_bot(message):
    payload = {"text": message}
    headers = {
        "Content-Type": "application/json",
    }
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    r = requests.post(API_URL, json=payload, headers=headers)
    return r.json()


def detect_intent_from_response(resp):
    """Suy luận intent từ JSON trả về của chatbot."""

    # Redirect → go_xxx
    if "action" in resp and resp["action"] == "redirect":
        to = resp["to"]
        if to == "/expenses": return "go_expense"
        if to == "/income": return "go_income"
        if to == "/budgets": return "go_budget"
        if to == "/savings": return "go_saving"
        if to == "/analytics": return "go_analytics"
        if to == "/": return "go_dashboard"

    # Confirm → add_transaction hoặc income
    if resp.get("confirm"):
        if resp.get("type") == "income":
            return "income_transaction"
        return "add_transaction"

    # Analysis  
    if "analysis" in resp:
        return "ask_analysis"

    # Report 
    if "message" in resp:
        msg = resp["message"].lower()
        if any(k in msg for k in [
            "báo cáo", "thống kê", "xem", "chi tiêu", "thu nhập", "tháng"
        ]):
            return "ask_report"

    return "unknown"


# ---------------------------
# CHẠY TEST TỰ ĐỘNG
# ---------------------------
@pytest.mark.parametrize("case", json.load(open("tests/test_cases.json", "r", encoding="utf-8")))
def test_chatbot(case):
    user_input = case["input"]
    expected_intent = case["expect"]

    response = call_bot(user_input)
    detected = detect_intent_from_response(response)

    # GHI LOG VÀO CSV
    write_log(case["id"], user_input, expected_intent, detected, response)

    # ASSERT KẾT QUẢ
    assert detected == expected_intent, (
        f"\n❌ FAILED\n"
        f"   Input: {user_input}\n"
        f"   Expected: {expected_intent}\n"
        f"   Detected: {detected}\n"
        f"   Response: {response}\n"
    )
