from ..extensions import db
# from passlib.hash import bcrypt
from sqlalchemy.sql import func
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index = True)
    full_name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False) #hash
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    expenses = db.relationship("Expense", backref="user", lazy=True)

    def set_password(self, password:str):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password:str) -> bool:
        return check_password_hash(self.password_hash, password)
    
    def to_public(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name
        }
    
    