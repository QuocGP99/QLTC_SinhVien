# backend/scripts/seed_category_expense.py
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.category import Category

# Danh muc chi tieu theo CATEGORY_MAP
DEFAULT_EXPENSE_CATS = [
    "Ăn uống",  # id: 5
    "Di chuyển",  # id: 6
    "Giải trí",  # id: 7
    "Mua sắm",  # id: 8
    "Học tập",  # id: 9
    "Sức khỏe",  # id: 10
    "Nhà ở",  # id: 11
    "Khác (expense)",  # id: 12
]


def run():
    app = create_app()
    with app.app_context():
        created = 0
        for name in DEFAULT_EXPENSE_CATS:
            # Kiểm tra xem danh mục đã tồn tại chưa
            exists = Category.query.filter_by(name=name, type="expense").first()
            if not exists:
                db.session.add(Category(name=name, type="expense"))
                created += 1

        db.session.commit()
        print(f"✅ Seed expense categories: +{created} item(s)")


if __name__ == "__main__":
    run()
