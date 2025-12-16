#!/usr/bin/env python
"""
Script để thêm cột avatar vào bảng users trong PostgreSQL
"""

from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Kiểm tra xem cột avatar đã tồn tại chưa
        result = db.session.execute(
            text(
                """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'avatar'
            """
            )
        ).fetchone()

        if result:
            print("✅ Cột avatar đã tồn tại trong bảng users")
        else:
            # Thêm cột avatar
            db.session.execute(text("ALTER TABLE users ADD COLUMN avatar VARCHAR(255)"))
            db.session.commit()
            print("✅ Đã thêm cột avatar vào bảng users thành công!")

    except Exception as e:
        db.session.rollback()
        print(f"❌ Lỗi: {e}")
