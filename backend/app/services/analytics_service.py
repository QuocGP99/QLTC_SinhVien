# backend/app/services/analytics_service.py
from datetime import date, timedelta, datetime
from collections import OrderedDict, defaultdict

from ..extensions import db
from ..models.expense import Expense
from ..models.income import Income
from ..models.category import Category
from ..models.budget import Budget

def sum_income_expense(user_id: int, d_from: date, d_to: date):
    q_exp = db.session.query(Expense).filter(
        Expense.user_id == user_id,
        Expense.spent_at >= d_from,
        Expense.spent_at <= d_to,
    )
    q_inc = db.session.query(Income).filter(
        Income.user_id == user_id,
        Income.received_at >= d_from,
        Income.received_at <= d_to,
    )
    total_expenses = float(sum(e.amount for e in q_exp.all()))
    total_income   = float(sum(i.amount for i in q_inc.all()))
    return total_income, total_expenses
