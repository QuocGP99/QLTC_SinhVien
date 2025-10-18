# scripts/seed_savings_category.py
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import Category

CATEGORY_TYPE = "saving"

DEFAULT_SAVINGS_CATS = [
    "Khẩn cấp",
    "Đồ công nghệ",
    "Du lịch",
    "Quà tặng",
    "Nhà ở",
    "Di chuyển",
    "Cá nhân",
    "Khác",
]

def run():
    with create_app().app_context():
        created = 0
        for name in DEFAULT_SAVINGS_CATS:
            exists = Category.query.filter_by(
                name=name, type=CATEGORY_TYPE, user_id=None
            ).first()
            if not exists:
                db.session.add(Category(name=name, type=CATEGORY_TYPE, user_id=None))
                created += 1
        if created:
            db.session.commit()
        print(f"Seed categories({CATEGORY_TYPE}): +{created} item(s).")

if __name__ == "__main__":
    run()
