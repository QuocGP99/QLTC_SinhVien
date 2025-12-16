# backend/scripts/seed_category_incomes.py
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.category import Category

# Danh muc thu nhap theo CATEGORY_MAP
DEFAULT_INCOME_CATS = [
    "Lương",  # id: 1
    "Học bổng",  # id: 2
    "Thưởng",  # id: 3
    "Khác (income)",  # id: 4
]


def run():
    app = create_app()
    with app.app_context():
        created = 0
        for name in DEFAULT_INCOME_CATS:
            # Kiểm tra xem danh mục đã tồn tại chưa
            exists = Category.query.filter_by(name=name, type="income").first()
            if not exists:
                db.session.add(Category(name=name, type="income"))
                created += 1

        db.session.commit()
        print(f"✅ Seed income categories: +{created} item(s)")


if __name__ == "__main__":
    run()
