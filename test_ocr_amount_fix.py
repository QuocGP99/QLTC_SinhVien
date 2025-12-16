#!/usr/bin/env python3
"""Test OCR amount extraction with the user's actual receipt"""

import sys

sys.path.insert(0, "backend")

from app.ai.nlp_rules import extract_amount_vnd

# Test with the actual receipt text from user
receipt_text = """0
HUAN TEA COFFEE
ĐC; 88 X/ Vlet Nghẹ Tính
SĐT; 0839922293
HOA ĐON THANH TOAN
CG161225-0055
Sô'
Ngày: 16/12/2025
Già
19.48
vào' 16/12/2025 19,48 Giờ ra: 16/12/2025
Bàn;
A7 A}
Khach
hàng:
Khach lẻ
Thu
ngân: nhanvien
Tẽn
hàng
TT
Đgiá
SL
TRÀ SỮA TRAN CHÀQ
30,000
30,000
SỮA
32,000
CHUA NHA ĐAM
32,000
Tổng
62,000
thành tền
Tổng
62,000
cộng
62,000
Tlền khach trẩ
Tlên thừa
Xin cam ơn, hẹn g#p lal quý khách!
QRCODEIPOS3ó5 VNIVNPAY
Powered by POS365 VN"""

print("Testing OCR amount extraction fix...")
print("-" * 50)

result = extract_amount_vnd(receipt_text)

print(f"Extracted amount: {result:,}" if result else f"Extracted amount: {result}")
print(f"Expected amount: 62,000")
print(f"Correct: {'✓ YES' if result == 62000 else '✗ NO'}")

# Additional test cases
test_cases = [
    ("Tổng cộng 150000 tiền", 150000),
    ("Thành tiền: 45500", 45500),
    ("Tổng thành tiền 89000", 89000),
    ("Số tiền: 120000", 120000),
]

print("\n" + "-" * 50)
print("Additional test cases:")
print("-" * 50)

all_passed = result == 62000

for text, expected in test_cases:
    extracted = extract_amount_vnd(text)
    status = "✓" if extracted == expected else "✗"
    all_passed = all_passed and (extracted == expected)
    print(f"{status} Input: '{text}' → Got {extracted}, Expected {expected}")

print("\n" + "-" * 50)
print(
    f"Overall: {'PASS - All tests passed!' if all_passed else 'FAIL - Some tests failed'}"
)
