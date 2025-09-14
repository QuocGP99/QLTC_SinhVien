import os

BASEDIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INSTANCE_DIR = os.path.join(BASEDIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)  # đảm bảo có thư mục instance

DB_PATH = os.path.join(INSTANCE_DIR, "app.db")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "sqlite:///" + DB_PATH.replace(os.sep, "/")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

