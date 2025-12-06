from ..extensions import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON

class AIFeedback(db.Model):
    __tablename__ = "ai_feedback"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    chosen_category_id = db.Column(db.Integer, nullable=False)
    ai_predictions = db.Column(JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
