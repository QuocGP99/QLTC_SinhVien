#!/usr/bin/env python
# Script to update database with avatar column

from app import create_app, db

app = create_app()
with app.app_context():
    try:
        db.create_all()
        print("✅ Database updated successfully with avatar column!")
    except Exception as e:
        print(f"❌ Error: {e}")
