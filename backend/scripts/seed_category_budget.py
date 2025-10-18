# backend/scripts/seed_budget_categories.py
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import Category

DEFAULT_BUDGET_CATS = [
    "Ăn uống",
    "Di chuyển",
    "Giải trí",
    "Mua sắm",
    "Học tập",
    "Sức khoẻ",  # dùng "Sức khoẻ" thống nhất với FE
    "Nhà ở",
]

def run():
    app = create_app()
    with app.app_context():
        created = 0
        for name in DEFAULT_BUDGET_CATS:
            exists = Category.query.filter_by(
                name=name, type="budget", user_id=None
            ).first()
            if not exists:
                cat = Category(name=name, type="budget", user_id=None)
                db.session.add(cat)
                created += 1

        if created:
            db.session.commit()
        print(f"✅ Seed categories (budget): +{created} item(s).")

if __name__ == "__main__":
    run()
