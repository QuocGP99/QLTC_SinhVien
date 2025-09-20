from ..extensions import db
from passlib.hash import bcrypt
from sqlalchemy.sql import func

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index = True)
    full_name = db.Column(db.String(120), nullable=False)
    password = db.Column(db.String(255), nullable=False) #hash
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def set_password(self, raw:str):
        self.password = bcrypt.hash(raw)
        
    def check_password(self, raw:str) -> bool:
        return bcrypt.verify(raw, self.password)
    
    def to_public(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name
        }
    
    