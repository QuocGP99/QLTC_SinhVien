import sys

sys.path.insert(0, "..")
from app import create_app
from app.extensions import db
from app.models.money_source import MoneySource

app = create_app()
with app.app_context():
    # Tạo các bảng từ model
    db.create_all()

    # Kiểm tra
    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()
    print(f"✓ Tables created: {', '.join(sorted(tables))}")

    if "money_sources" in tables:
        print("✓ money_sources table created successfully!")
    else:
        print("✗ money_sources table NOT found")
