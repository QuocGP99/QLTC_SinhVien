#backend/app/models/otp.py
from datetime import timedelta
from ..utils.timezone import now_local
from . import db, BaseModel

class OTPVerification(BaseModel):
    __tablename__ = "otp_verifications"

    email = db.Column(db.String(255), nullable=False, index=True)
    code = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=now_local)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)

    @classmethod
    def create_for(cls, email, code, ttl_min=10):
        otp = cls(
            email=email,
            code=code,
            expires_at=now_local() + timedelta(minutes=int(ttl_min))
        )
        db.session.add(otp)
        db.session.commit()
        return otp

    def is_valid(self):
        return (not self.used) and (self.expires_at > now_local())

    def mark_used(self):
        self.used = True
        db.session.commit()
