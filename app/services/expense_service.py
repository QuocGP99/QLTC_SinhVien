# app/services/expense_service.py
from __future__ import annotations
from typing import Any, Dict, Optional, Tuple

from datetime import datetime
from dateutil.parser import isoparse  # robust ISO parser (YYYY-MM-DD / YYYY-MM-DDTHH:MM:SS)
from sqlalchemy import and_, desc

from ..extensions import db
from ..models import Expense, Category


# ----- Error type cho service -----
class ServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# ----- Helpers -----
def _parse_date_str(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        # chấp nhận "2025-10-10" hoặc "2025-10-10T13:45:00"
        return isoparse(s)
    except Exception:
        raise ServiceError("Ngày không hợp lệ, cần dạng ISO (YYYY-MM-DD hoặc YYYY-MM-DDTHH:MM:SS)", 400)


def _ensure_category(category_id: int) -> Category:
    cat = Category.query.get(category_id)
    if not cat:
        raise ServiceError("category_id không tồn tại", 400)
    return cat


# ----- Services chính -----
def list_expenses(
    user_id: int,
    category_name: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Dict[str, Any]:
    """
    Trả về danh sách expense của user: có lọc theo category_name và khoảng thời gian [start, end].
    Phân trang: page, per_page.
    """
    q = Expense.query.filter(Expense.user_id == user_id)

    if category_name:
        q = q.join(Category).filter(Category.name == category_name)

    start_dt = _parse_date_str(start)
    end_dt = _parse_date_str(end)
    if start_dt:
        q = q.filter(Expense.date >= start_dt)
    if end_dt:
        q = q.filter(Expense.date <= end_dt)

    q = q.order_by(desc(Expense.date), desc(Expense.id))

    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return {
        "items": [e.to_dict() for e in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    }


def create_expense(user_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    data yêu cầu: amount (float), category_id (int)
    tuỳ chọn: date (ISO string), note (str), payment_method (str)
    """
    if not isinstance(data, dict):
        raise ServiceError("Body phải là JSON object", 400)

    try:
        amount = float(data["amount"])
        if amount <= 0:
            raise ServiceError("amount phải > 0", 400)
    except KeyError:
        raise ServiceError("Thiếu trường bắt buộc: amount", 400)
    except (TypeError, ValueError):
        raise ServiceError("amount không hợp lệ", 400)

    try:
        category_id = int(data["category_id"])
    except KeyError:
        raise ServiceError("Thiếu trường bắt buộc: category_id", 400)
    except (TypeError, ValueError):
        raise ServiceError("category_id không hợp lệ", 400)

    _ensure_category(category_id)

    note = data.get("note", "") or ""
    payment_method = data.get("payment_method", "Tiền mặt") or "Tiền mặt"

    date_str = data.get("date")
    dt = _parse_date_str(date_str) if date_str else datetime.now()

    e = Expense(
        user_id=user_id,
        amount=amount,
        date=dt,
        note=note,
        payment_method=payment_method,
        category_id=category_id,
    )
    db.session.add(e)
    db.session.commit()
    return e.to_dict()


def get_expense(user_id: int, expense_id: int) -> Dict[str, Any]:
    e = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not e:
        raise ServiceError("Không tìm thấy chi tiêu", 404)
    return e.to_dict()


def update_expense(user_id: int, expense_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    e = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not e:
        raise ServiceError("Không tìm thấy chi tiêu", 404)

    if "amount" in data:
        try:
            val = float(data["amount"])
            if val <= 0:
                raise ServiceError("amount phải > 0", 400)
            e.amount = val
        except (TypeError, ValueError):
            raise ServiceError("amount không hợp lệ", 400)

    if "date" in data:
        e.date = _parse_date_str(data["date"]) or e.date

    if "note" in data:
        e.note = data.get("note") or ""

    if "payment_method" in data:
        e.payment_method = data.get("payment_method") or "Tiền mặt"

    if "category_id" in data:
        try:
            new_cid = int(data["category_id"])
        except (TypeError, ValueError):
            raise ServiceError("category_id không hợp lệ", 400)
        _ensure_category(new_cid)
        e.category_id = new_cid

    db.session.commit()
    return e.to_dict()


def delete_expense(user_id: int, expense_id: int) -> int:
    e = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not e:
        raise ServiceError("Không tìm thấy chi tiêu", 404)
    db.session.delete(e)
    db.session.commit()
    return expense_id
