# backend/scripts/seed_admin.py
import os
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.user import User

from werkzeug.security import generate_password_hash

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123@")

def run():
    app = create_app()
    with app.app_context():
        u = User.query.filter_by(email=ADMIN_EMAIL).first()
        if u:
            if getattr(u, "role", "user") != "admin":
                u.role = "admin"
                db.session.commit()
                print(f"Updated role=admin for {ADMIN_EMAIL}")
            else:
                print(f"Admin already exists: {ADMIN_EMAIL}")
            return

        u = User(
            email=ADMIN_EMAIL,
            full_name="Administrator",
            role="admin"
        )
        u.password_hash = generate_password_hash(ADMIN_PASSWORD)
        db.session.add(u); db.session.commit()
        print(f"Created admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")

if __name__ == "__main__":
    run()
