"""seed default budget categories

Revision ID: 9771022f0b57
Revises: 58feef67a7c0
Create Date: 2025-10-16 02:05:41.094137

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9771022f0b57'
down_revision = '58feef67a7c0'
branch_labels = None
depends_on = None


DEFAULT_BUDGET_CATS = [
    "Ăn uống",
    "Di chuyển",
    "Giải trí",
    "Mua sắm",
    "Học tập",
    "Sức khoẻ",   # theo yêu cầu của bạn (khác "Sức khỏe")
    "Nhà ở",
]

def _insert_if_not_exists(conn, name: str):
    # Dùng cú pháp portable: INSERT ... SELECT ... WHERE NOT EXISTS ...
    conn.execute(
        sa.text(
            """
            INSERT INTO categories (name, type, user_id)
            SELECT :name, 'budget', NULL
            WHERE NOT EXISTS (
                SELECT 1 FROM categories
                 WHERE LOWER(name) = LOWER(:name)
                   AND type = 'budget'
                   AND user_id IS NULL
            )
            """
        ),
        {"name": name},
    )

def upgrade():
    conn = op.get_bind()

    # (Khuyến nghị) Kiểm tra CHECK constraint đã cho phép 'budget' chưa
    ddl = conn.execute(
        sa.text("SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'")
    ).scalar() or ""
    if "budget" not in ddl:
        # Nếu chưa có, bạn đã chạy migration rebuild CHECK chưa?
        # Không raise hard error để tránh fail pipeline; vẫn thử insert để DB báo lỗi rõ ràng nếu chưa cho phép.
        pass

    for name in DEFAULT_BUDGET_CATS:
        _insert_if_not_exists(conn, name)


def downgrade():
    conn = op.get_bind()

    # Xoá các category vừa seed nếu KHÔNG đang được tham chiếu (tránh lỗi FK)
    # Nếu có bảng budgets/expenses tham chiếu, chỉ xóa các bản ghi không bị dùng.
    conn.execute(
        sa.text(
            f"""
            DELETE FROM categories
             WHERE type = 'budget'
               AND user_id IS NULL
               AND name IN :names
               AND NOT EXISTS (SELECT 1 FROM budgets  WHERE budgets.category_id = categories.id)
               AND NOT EXISTS (SELECT 1 FROM expenses WHERE expenses.category_id = categories.id)
            """
        ),
        {"names": tuple(DEFAULT_BUDGET_CATS)},
    )