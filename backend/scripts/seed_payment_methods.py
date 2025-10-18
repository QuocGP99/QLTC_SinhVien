from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import PaymentMethod

DEFAULT_PM = [
    "Tiền mặt",
    "Thẻ tín dụng(Credit Card)",
    "Thẻ ghi nợ(Debit Card)",
    "Ví điện tử",
    "Chuyển khoản",
    "Khác",
]

def run():
    with create_app().app_context():
        created = 0
        for name in DEFAULT_PM:
            exists = PaymentMethod.query.filter_by(name=name, user_id=None).first()
            if not exists:
                db.session.add(PaymentMethod(name=name, user_id=None))
                created += 1
        if created:
            db.session.commit()
        print(f"Seed payment_methods: +{created} item(s).")

if __name__ == "__main__":
    run()
