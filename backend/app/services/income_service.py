# backend/app/services/income_service.py
from __future__ import annotations
from typing import Any, Dict, Optional
from datetime import datetime
from dateutil.parser import isoparse
from sqlalchemy import and_, desc
from ..extensions import db
from ..models import Income, Category


class ServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _parse_date_str(s: Optional[str]) -> Optional[datetime]:
    """Chuyển chuỗi ISO (YYYY-MM-DD / YYYY-MM-DDTHH:MM:SS) -> datetime"""
    if not s:
        return None
    try:
        return isoparse(s)
    except Exception:
        raise ServiceError("Ngày không hợp lệ, cần dạng YYYY-MM-DD hoặc ISO8601", 400)


def _ensure_category(category_id: int) -> Category:
    cat = Category.query.get(category_id)
    if not cat:
        raise ServiceError("category_id không tồn tại", 400)
    if cat.type != "income":
        raise ServiceError("category_id phải thuộc loại 'income'", 400)
    return cat


# ===== CRUD chính =====
def list_incomes(
    user_id: int,
    category_name: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Dict[str, Any]:
    """
    Trả về danh sách thu nhập của user: có thể lọc theo category_name, khoảng thời gian.
    """
    q = Income.query.filter(Income.user_id == user_id)
    if category_name:
        q = q.join(Category).filter(Category.name == category_name)

    start_dt = _parse_date_str(start)
    end_dt = _parse_date_str(end)
    if start_dt:
        q = q.filter(Income.received_at >= start_dt)
    if end_dt:
        q = q.filter(Income.received_at <= end_dt)

    q = q.order_by(desc(Income.received_at), desc(Income.id))
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [i.to_dict() for i in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    }


def create_income(user_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """Tạo thu nhập mới"""
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
    note = (data.get("note") or "").strip()
    date_str = data.get("date") or data.get("received_at")
    dt = _parse_date_str(date_str) or datetime.now()

    inc = Income(
        user_id=user_id,
        amount=amount,
        category_id=category_id,
        note=note,
        received_at=dt,
    )
    db.session.add(inc)
    db.session.commit()
    return inc.to_dict()


def get_income(user_id: int, income_id: int) -> Dict[str, Any]:
    inc = Income.query.filter_by(id=income_id, user_id=user_id).first()
    if not inc:
        raise ServiceError("Không tìm thấy thu nhập", 404)
    return inc.to_dict()


def update_income(user_id: int, income_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    inc = Income.query.filter_by(id=income_id, user_id=user_id).first()
    if not inc:
        raise ServiceError("Không tìm thấy thu nhập", 404)

    if "amount" in data:
        try:
            val = float(data["amount"])
            if val <= 0:
                raise ServiceError("amount phải > 0", 400)
            inc.amount = val
        except (TypeError, ValueError):
            raise ServiceError("amount không hợp lệ", 400)

    if "date" in data or "received_at" in data:
        date_str = data.get("date") or data.get("received_at")
        inc.received_at = _parse_date_str(date_str) or inc.received_at

    if "note" in data:
        inc.note = data.get("note") or ""

    if "category_id" in data:
        try:
            new_cid = int(data["category_id"])
        except (TypeError, ValueError):
            raise ServiceError("category_id không hợp lệ", 400)
        _ensure_category(new_cid)
        inc.category_id = new_cid

    db.session.commit()
    return inc.to_dict()


def delete_income(user_id: int, income_id: int) -> int:
    inc = Income.query.filter_by(id=income_id, user_id=user_id).first()
    if not inc:
        raise ServiceError("Không tìm thấy thu nhập", 404)
    db.session.delete(inc)
    db.session.commit()
    return income_id
