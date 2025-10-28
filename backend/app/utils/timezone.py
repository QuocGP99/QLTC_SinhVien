#backend/app/utils/timezone.py
from datetime import datetime, timedelta, timezone

# Giờ Việt Nam (UTC+7)
VN_TZ = timezone(timedelta(hours=7))

def now_local():
    """Trả về thời gian hiện tại theo giờ Việt Nam"""
    return datetime.now(VN_TZ)

def now_utc():
    """Trả về thời gian UTC"""
    return datetime.now(timezone.utc)
