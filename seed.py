from app import create_app
from app.extensions import db
from app.models import Category, Expense
from datetime import date, timedelta
import random

app = create_app()

def main():
    with app.app_context():
        names = ["Ăn uống", "Di chuyển", "Nhà trọ","Học tập", "Giải trí", "Sức khoẻ"]
        ids = {}
        for n in names:
            c = Category.query.filter_by(name=n).first()
            if not c:
                c = Category(name=n, type="expense")
                db.session.add(c); db.session.flush()
            ids[n] = c.id
        db.session.commit()

        today = date.today()
        start = date.today() - timedelta(days=30)
        methods = ["Tiền mặt", "Momo", "Chuyển khoản", "Thẻ tín dụng"]
        notes = ["", "cafe", "xem phim", "đi chợ", "mua sách", "grab"]
    
        for _ in range(100):
            d = start + timedelta(days=random.randint(0, 90))
            e = Expense(
                amount = round(random.uniform(20000, 30000), 0),
                date = d,
                note = random.choice(notes),
                payment_method = random.choice(methods),
                category_id = random.choice(list(ids.values()))
            )
            db.session.add(e)
        db.session.commit()
        print("Đã thêm 100 dữ liệu mẫu chi tiêu.")

if __name__ == "__main__":
    main()
  