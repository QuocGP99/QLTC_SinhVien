from app import create_app
from app.extensions import db
from app.services.expense_service import get_daily_expense_series

app = create_app()

with app.app_context():
    data = get_daily_expense_series(13)   # user_id bạn muốn test
    print("Số ngày có dữ liệu:", len(data))
    print("10 dòng đầu:")
    print(data[:10])
