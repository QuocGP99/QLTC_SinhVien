#Alembic thấy tất cả các model

from .category import Category
from .expense import Expense
#dang ky user models
from .user import User

def register_models():
    return [Category, Expense, User]