# backend/app/services/subscription_service.py
from decimal import Decimal
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy import func
from ..models.subscription import Subscription
from ..extensions import db


def get_brand_logo(service_name: str) -> str:
    """
    Lấy logo từ Google Favicon API dựa trên tên dịch vụ
    Sử dụng mapping từ điển + fallback thông minh
    """
    name_lower = service_name.lower().strip()
    
    # Ánh xạ tên dịch vụ -> domain
    mapping = {
        "netflix": "netflix.com",
        "spotify": "spotify.com",
        "youtube": "youtube.com",
        "google one": "drive.google.com",
        "drive": "drive.google.com",
        "icloud": "icloud.com",
        "apple": "apple.com",
        "adobe": "adobe.com",
        "photoshop": "adobe.com",
        "chatgpt": "openai.com",
        "openai": "openai.com",
        "office": "office.com",
        "microsoft": "microsoft.com",
        "dropbox": "dropbox.com",
        "zoom": "zoom.us",
        "canva": "canva.com",
        "github": "github.com",
        "facebook": "facebook.com",
        "tinder": "tinder.com",
        "momo": "momo.vn",
        "zalopay": "zalopay.vn",
        "figma": "figma.com",
        "slack": "slack.com",
        "discord": "discord.com",
        "notion": "notion.so",
        "linear": "linear.app",
    }
    
    # Tìm trong mapping
    domain = None
    for key, val in mapping.items():
        if key in name_lower:
            domain = val
            break
    
    # Fallback: tên + .com
    if not domain:
        domain = name_lower.replace(" ", "") + ".com"
    
    # Tạo URL Google Favicon API
    logo_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    return logo_url


class SubscriptionService:
    """Service layer cho Subscription business logic"""
    
    @staticmethod
    def get_user_subscriptions(user_id: int, status: str | None = None) -> list[Subscription]:
        """Lấy danh sách subscription của user"""
        query = Subscription.query.filter_by(user_id=user_id)
        if status:
            query = query.filter_by(status=status)
        return query.order_by(Subscription.next_billing_date.asc()).all()
    
    @staticmethod
    def create_subscription(
        user_id: int,
        name: str,
        price: int,
        start_date: date | str,
        cycle_months: int = 1,
        category: str = "Other",
        notes: str = None,
    ) -> Subscription:
        """Tạo subscription mới"""
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        
        logo_url = get_brand_logo(name)
        
        sub = Subscription(
            user_id=user_id,
            name=name,
            price=price,
            start_date=start_date,
            next_billing_date=start_date,
            cycle_months=max(1, cycle_months),
            category=category,
            logo_url=logo_url,
            notes=notes,
            status="active",
        )
        
        sub.calculate_next_billing()
        db.session.add(sub)
        db.session.commit()
        
        return sub
    
    @staticmethod
    def update_subscription(
        sub_id: int,
        user_id: int,
        **kwargs
    ) -> Subscription:
        """Cập nhật subscription"""
        sub = Subscription.query.filter_by(id=sub_id, user_id=user_id).first_or_404()
        
        # Các trường có thể cập nhật
        updateable_fields = ['name', 'price', 'cycle_months', 'category', 'notes', 'status']
        for field in updateable_fields:
            if field in kwargs:
                setattr(sub, field, kwargs[field])
        
        # Nếu cập nhật start_date
        if 'start_date' in kwargs:
            start_date = kwargs['start_date']
            if isinstance(start_date, str):
                start_date = date.fromisoformat(start_date)
            sub.start_date = start_date
            sub.next_billing_date = start_date
            sub.calculate_next_billing()
        
        db.session.commit()
        return sub
    
    @staticmethod
    def delete_subscription(sub_id: int, user_id: int) -> bool:
        """Xóa subscription"""
        sub = Subscription.query.filter_by(id=sub_id, user_id=user_id).first_or_404()
        db.session.delete(sub)
        db.session.commit()
        return True
    
    @staticmethod
    def get_monthly_cost(user_id: int, status: str = "active") -> int:
        """
        Tính tổng chi phí hàng tháng (ước tính)
        Tính trung bình từ những subscription hoạt động
        """
        subs = Subscription.query.filter_by(user_id=user_id, status=status).all()
        total = 0
        for sub in subs:
            # Giả sử chi phí hàng tháng = giá / số tháng của cycle
            monthly = sub.price / max(1, sub.cycle_months)
            total += int(monthly)
        return total
    
    @staticmethod
    def get_category_stats(user_id: int, status: str = "active") -> dict:
        """
        Thống kê chi phí theo danh mục
        Return: {category: total_monthly_cost}
        """
        subs = Subscription.query.filter_by(user_id=user_id, status=status).all()
        stats = {}
        
        for sub in subs:
            monthly = sub.price / max(1, sub.cycle_months)
            if sub.category not in stats:
                stats[sub.category] = 0
            stats[sub.category] += int(monthly)
        
        return stats
    
    @staticmethod
    def get_upcoming_billings(user_id: int, days: int = 30) -> list[Subscription]:
        """
        Lấy danh sách subscription sắp được thanh toán trong N ngày
        """
        today = date.today()
        future_date = today + relativedelta(days=days)
        
        return Subscription.query.filter_by(
            user_id=user_id,
            status="active"
        ).filter(
            Subscription.next_billing_date.between(today, future_date)
        ).order_by(Subscription.next_billing_date.asc()).all()
    
    @staticmethod
    def process_billing_date(sub: Subscription) -> None:
        """
        Kiểm tra và cập nhật ngày thanh toán tiếp theo
        Được gọi khi user truy cập để đảm bảo dữ liệu luôn mới nhất
        """
        sub.calculate_next_billing()
        db.session.commit()
