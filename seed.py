from app import create_app
from app.extensions import db
from app.models import Category, Expense
from app.models.user import User
from datetime import date, timedelta, datetime
import random

app = create_app()

def main():
    with app.app_context():
        # Lấy user demo (đã tạo bằng seed_user.py)
        demo = User.query.filter_by(email="demo@gmail.com").first()
        if not demo:
            raise RuntimeError("Chưa có user demo@gmail.com. Hãy chạy: python seed_user.py")

        # Categories
        names = ["Ăn uống", "Di chuyển", "Nhà trọ", "Học tập", "Giải trí", "Sức khoẻ"]
        ids = {}
        for n in names:
            c = Category.query.filter_by(name=n).first()
            if not c:
                c = Category(name=n, type="expense")
                db.session.add(c)
                db.session.flush()
            ids[n] = c.id
        db.session.commit()

        # Expenses
        today = date.today()
        start = today - timedelta(days=30)
        methods = ["Tiền mặt", "Momo", "Chuyển khoản", "Thẻ tín dụng"]
        notes = ["", "cafe", "xem phim", "đi chợ", "mua sách", "grab"]

        for _ in range(10):
            d = start + timedelta(days=random.randint(0, (today - start).days))
            # Nếu cột date là DateTime -> chuyển sang datetime
            dt = datetime(d.year, d.month, d.day, random.randint(7, 21), random.randint(0, 59), 0)

            e = Expense(
                user_id=demo.id,                              # <— gắn user
                amount=int(round(random.uniform(20000, 300000), 0)),
                date=dt,                                      # dùng dt nếu cột là DateTime
                note=random.choice(notes),
                payment_method=random.choice(methods),
                category_id=random.choice(list(ids.values()))
            )
            db.session.add(e)
        db.session.commit()
        print("✅ Đã thêm 10 dữ liệu mẫu chi tiêu (gắn user demo).")

if __name__ == "__main__":
    main()
