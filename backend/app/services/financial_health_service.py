from datetime import date
from statistics import mean, stdev
from calendar import monthrange

from ..models.budget import Budget
from ..models.saving import SavingsGoal
from ..models.expense import Expense
from ..models.income import Income

from ..extensions import db

from ..services.forecast_service import build_expense_forecast


def compute_financial_health(user_id: int, year: int, month: int):
    """Tính điểm AI theo tháng cụ thể"""

    # ==== 1) NGÂN SÁCH ====
    budgets = Budget.query.filter_by(
        user_id=user_id,
        period_year=year,
        period_month=month
    ).all()

    total_limit = sum(float(b.limit_amount) for b in budgets)
    total_spent = 0
    for b in budgets:
        spent_amount = (
            Expense.query.filter_by(
                user_id=user_id,
                category_id=b.category_id
            )
            .with_entities(db.func.sum(Expense.amount))
            .scalar()
        ) or 0
        total_spent += float(spent_amount)


    if total_limit > 0:
        percent_over = (total_spent - total_limit) / total_limit * 100
    else:
        percent_over = 0

    # Score ngân sách
    if percent_over <= 0:
        score_budget = 10
    elif percent_over <= 10:
        score_budget = 8
    elif percent_over <= 20:
        score_budget = 6
    elif percent_over <= 40:
        score_budget = 4
    else:
        score_budget = 0

    # ==== 2) TIẾT KIỆM ====
    goals = SavingsGoal.query.filter_by(user_id=user_id).all()

    if goals:
        ratios = []
        for g in goals:
            if g.target_amount and g.target_amount > 0:
                ratio = float(g.current_amount) / float(g.target_amount)
                ratios.append(ratio)

        saving_ratio = sum(ratios) / len(ratios) if ratios else 0
    else:
        saving_ratio = 0

    # chấm điểm tiết kiệm
    if saving_ratio >= 0.8:
        score_saving = 10
    elif saving_ratio >= 0.5:
        score_saving = 7
    elif saving_ratio >= 0.2:
        score_saving = 4
    else:
        score_saving = 0


    # ==== 3) XU HƯỚNG PROPHET ====
    forecast_data = build_expense_forecast(user_id)

    # Nếu không đủ dữ liệu
    if isinstance(forecast_data, dict) and forecast_data.get("error"):
        change_ratio = 0
        predicted_month_amount = 0
    else:
        predicted_month_amount = forecast_data["total_forecast"]
    # convert % về dạng ratio 0.xx
    change_ratio = (forecast_data["change_pct"] / 100.0) if forecast_data["change_pct"] is not None else 0


    if change_ratio < -0.15:
        score_trend = 10
    elif change_ratio < 0:
        score_trend = 7
    elif change_ratio <= 0.2:
        score_trend = 4
    else:
        score_trend = 0

    # ==== 4) ỔN ĐỊNH THU NHẬP ====
    incomes = Income.query.filter_by(user_id=user_id).order_by(Income.created_at.desc()).limit(3).all()

    if len(incomes) >= 2:
        amounts = [float(i.amount) for i in incomes]
        ratio_income = stdev(amounts) / mean(amounts)
    else:
        ratio_income = 0

    if ratio_income <= 0.1:
        score_income = 10
    elif ratio_income <= 0.3:
        score_income = 7
    elif ratio_income <= 0.5:
        score_income = 4
    else:
        score_income = 0

    # ==== 5) TÍNH ĐIỂM TỔNG ====
    score = (
        score_budget * 0.4 +
        score_saving * 0.3 +
        score_trend * 0.2 +
        score_income * 0.1
    )

    score = round(score, 1)

    # ==== 6) PHÂN LOẠI ====
    if score >= 8:
        level = "good"
    elif score >= 5:
        level = "medium"
    else:
        level = "bad"

    # ==== 7) GỢI Ý AI ====
    tips = []

    if percent_over > 10:
        tips.append("Bạn đang chi vượt ngân sách, cần xem lại các khoản chi.")

    if saving_ratio < 0.5:
        tips.append("Tỷ lệ tiết kiệm thấp, nên đặt auto-saving để cải thiện.")

    if change_ratio > 0.1:
        tips.append("Dự báo chi tiêu tháng tới tăng, nên cắt giảm chi cố định.")

    if ratio_income > 0.3:
        tips.append("Thu nhập biến động lớn, hãy duy trì quỹ dự phòng ít nhất 3 tháng.")

    if not tips:
        tips.append("Tình hình tài chính ổn định, hãy tiếp tục duy trì thói quen tốt.")

    return {
        "score": score,
        "level": level,
        "budget_score": score_budget,
        "saving_score": score_saving,
        "trend_score": score_trend,
        "income_score": score_income,
        "percent_over": percent_over,
        "saving_ratio": saving_ratio,
        "trend_change": change_ratio,
        "predicted_next_month": predicted_month_amount,
        "income_volatility": ratio_income,
        "tips": tips
    }
