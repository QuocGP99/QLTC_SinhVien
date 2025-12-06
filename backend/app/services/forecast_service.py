from prophet import Prophet
import pandas as pd
from datetime import timedelta
from .expense_service import get_daily_expense_series


def build_expense_forecast(user_id: int, periods: int = 30):
    """
    Huấn luyện mô hình Prophet từ dữ liệu chi tiêu theo ngày.
    Dự báo 'periods' ngày tiếp theo (mặc định 30).
    """

    # 1. Lấy dữ liệu time series
    series = get_daily_expense_series(user_id)

    if len(series) < 60:
        return {
            "error": "not_enough_data",
            "days": len(series)
        }

    df = pd.DataFrame(series)
    df["ds"] = pd.to_datetime(df["ds"])  # Prophet yêu cầu datetime

    # 2. Khởi tạo và train model Prophet
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.3
    )
    model.fit(df)

    # 3. Tạo dataframe tương lai
    future = model.make_future_dataframe(periods=periods)
    forecast = model.predict(future)

    # Tách phần history và forecast
    history = forecast.iloc[:-periods].copy()
    future_part = forecast.iloc[-periods:].copy()

    # Tổng chi dự báo 30 ngày tới
    total_forecast = float(future_part["yhat"].sum())

    # Tổng chi 30 ngày trước đó để so sánh
    last_start = history["ds"].max() - timedelta(days=periods - 1)
    last_period = history[history["ds"] >= last_start]
    total_last = float(last_period["yhat"].sum()) if len(last_period) else 0

    # % tăng/giảm
    if total_last > 0:
        change_pct = (total_forecast - total_last) / total_last * 100
    else:
        change_pct = None

    return {
        "history": history[["ds", "yhat"]].rename(columns={"yhat": "value"}).to_dict(orient="records"),
        "forecast": future_part[["ds", "yhat"]].rename(columns={"yhat": "value"}).to_dict(orient="records"),
        "total_forecast": round(total_forecast, 2),
        "total_last": round(total_last, 2),
        "change_pct": round(change_pct, 2) if change_pct is not None else None,
    }
