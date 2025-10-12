from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_caching import Cache
#jwt
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
migrate = Migrate()
cache = Cache()
jwt = JWTManager()

#jwt blocklist
jwt_blocklist = set() #jti of revoked tokens