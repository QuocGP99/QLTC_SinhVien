import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ----- Cấu hình nguồn và đích -----
SQLITE_URL = "sqlite:///backend/instance/app.db"
POSTGRES_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://svfinance_user:svf12345@localhost:5432/svfinance"
)

# ----- Import app + models -----
from backend.app import create_app
from backend.app.models.user import User
from backend.app.models.category import Category
from backend.app.models.payment_method import PaymentMethod
from backend.app.models.budget import Budget
from backend.app.models.saving import SavingsGoal
from backend.app.models.expense import Expense
from backend.app.models.income import Income
from backend.app.models.otp import OTPVerification

# ----- Kết nối -----
sqlite_engine = create_engine(SQLITE_URL)
pg_engine = create_engine(POSTGRES_URL)

SQLiteSession = sessionmaker(bind=sqlite_engine)
PGSession = sessionmaker(bind=pg_engine)

src = SQLiteSession()
dst = PGSession()

def copy_table(Model):
    rows = src.query(Model).all()
    print(f"Copy {Model.__tablename__}: {len(rows)} rows")
    for r in rows:
        data = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        dst.merge(Model(**data))
    dst.commit()

def main():
    copy_table(User)
    copy_table(Category)
    try:
        copy_table(PaymentMethod)
    except Exception:
        pass
    copy_table(SavingsGoal)
    copy_table(Budget)
    copy_table(Income)
    copy_table(Expense)
    try:
        copy_table(OTPVerification)
    except Exception:
        pass
    print("Done copying all data!")

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        main()
