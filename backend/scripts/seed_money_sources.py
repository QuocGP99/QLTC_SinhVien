import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.money_source import MoneySource
from app.models.payment_method import PaymentMethod
from app.models.user import User


def run():
    """
    Tạo money sources mẫu với tên trùng payment methods
    để auto-mapping giữa payment method và money source
    """
    app = create_app()
    with app.app_context():
        # Lấy user đầu tiên
        user = User.query.first()
        if not user:
            print("❌ Không tìm thấy user nào trong database.")
            return

        print(f"📝 Tạo money sources cho user: {user.email}")

        sources = [
            {"name": "Tiền mặt", "type": "cash", "balance": 1000000},
            {"name": "Thẻ tín dụng(Credit Card)", "type": "credit_card", "balance": 0},
            {
                "name": "Thẻ ghi nợ(Debit Card)",
                "type": "bank_account",
                "balance": 5000000,
            },
            {"name": "Ví điện tử", "type": "ewallet", "balance": 2000000},
            {"name": "Chuyển khoản", "type": "bank_account", "balance": 3000000},
            {"name": "Khác", "type": "other", "balance": 500000},
        ]

        created = 0
        for src_data in sources:
            exists = MoneySource.query.filter_by(
                user_id=user.id, name=src_data["name"]
            ).first()
            if not exists:
                source = MoneySource(
                    user_id=user.id,
                    name=src_data["name"],
                    type=src_data["type"],
                    balance=src_data["balance"],
                    description=f"Tự động tạo từ payment method",
                    is_active=True,
                )
                db.session.add(source)
                created += 1

        db.session.commit()
        print(f"✅ Tạo {created} money sources cho user")


if __name__ == "__main__":
    run()
