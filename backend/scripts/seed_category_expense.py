# backend/scripts/seed_categories_expense.py
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import Category
import unicodedata as ud

DEFAULT_EXPENSE_CATS = [
    "Ăn uống",
    "Di chuyển",
    "Giải trí",
    "Mua sắm",
    "Học tập",
    "Sức khỏe",  
    "Nhà ở",
    "Khác",
]

def norm(s: str) -> str:
    return ud.normalize("NFC", (s or "").strip())

def run():
    with create_app().app_context():
        created = 0
        for raw_name in DEFAULT_EXPENSE_CATS:
            name = norm(raw_name)
            exists = Category.query.filter_by(name=name, type="expense", user_id=None).first()
            if not exists:
                db.session.add(Category(name=name, type="expense", user_id=None))
                created += 1
        if created:
            db.session.commit()
        print(f"Seed categories(expense): +{created} item(s).")

if __name__ == "__main__":
    run()
