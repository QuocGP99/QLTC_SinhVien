# backend/scripts/seed_categories.py
from ..app import create_app
from ..app.extensions import db
from ..app.models.category import Category

CATS = ["Ăn uống", "Di chuyển", "Giải trí", "Mua sắm", "Học tập", "Sức khỏe"]

def run():
    app = create_app()
    with app.app_context():
        added = 0
        for name in CATS:
            exists = Category.query.filter(db.func.lower(Category.name) == name.lower()).first()
            if not exists:
                db.session.add(Category(name=name, type="expense"))
                added += 1
        db.session.commit()
        print(f"✅ Seed xong: thêm {added} danh mục.")

if __name__ == "__main__":
    run()
