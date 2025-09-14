#Alembic thấy tất cả các model

from .category import Category
from .expense import Expense

def register_models():
    return [Category, Expense]