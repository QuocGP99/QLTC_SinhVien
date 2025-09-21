from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

def main():
    with app.app_context():
        # Tạo user demo
        email = "demo@gmail.com"
        full_name = "Demo1"
        password = "Demo@123"

        # Kiểm tra nếu chưa tồn tại thì thêm mới
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(email=email, full_name=full_name)
            user.set_password(password)   # hash mật khẩu
            db.session.add(user)
            db.session.commit()
            print(f"✅ Đã tạo user demo: {email} / {password}")
        else:
            print("ℹ️ User demo đã tồn tại, bỏ qua.")

if __name__ == "__main__":
    main()
