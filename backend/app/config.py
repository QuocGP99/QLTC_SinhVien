import os

BASEDIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INSTANCE_DIR = os.path.join(BASEDIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)  # đảm bảo có thư mục instance

DB_PATH = os.path.join(INSTANCE_DIR, "app.db")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DB_PATH.replace('\\', '/')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- JWT ---
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")

    # Cho phép đọc token cả từ header và cookie
    JWT_TOKEN_LOCATION = ["headers", "cookies"]

    # Thời hạn (giữ như bạn đang để)
    JWT_ACCESS_TOKEN_EXPIRES = 3600                 # 1h
    JWT_REFRESH_TOKEN_EXPIRES = 60 * 60 * 24 * 7    # 7 ngày

    # Cấu hình cookie (DEV)
    JWT_COOKIE_SECURE = False        # Để True khi deploy HTTPS
    JWT_COOKIE_SAMESITE = "Lax"      # "Lax" là hợp lý cho app cùng domain
    JWT_COOKIE_CSRF_PROTECT = False  # Bật True ở production + thêm CSRF token

    # (tuỳ chọn) đổi tên cookie cho gọn
    JWT_ACCESS_COOKIE_NAME = "access_token"
    JWT_REFRESH_COOKIE_NAME = "refresh_token"

    # (tuỳ chọn) phạm vi đường dẫn cookie; '/' để dùng cho cả / và /api
    JWT_ACCESS_COOKIE_PATH = "/"
    JWT_REFRESH_COOKIE_PATH = "/"

    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USE_SSL = os.getenv("MAIL_USE_SSL", "false").lower() == "true"
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", MAIL_USERNAME)
    MAIL_SUPPRESS_SEND = os.getenv("MAIL_SUPPRESS_SEND", "false").lower() == "true"  # set true để test ko gửi
