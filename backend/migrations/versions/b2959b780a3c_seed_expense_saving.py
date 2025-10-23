"""seed_expense_saving

Revision ID: b2959b780a3c
Revises: da0c6c8cfbb4
Create Date: 2025-10-21 03:47:41.193229

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2959b780a3c'
down_revision = 'da0c6c8cfbb4'
branch_labels = None
depends_on = None



EXPENSE = ["Ăn uống", "Di chuyển", "Giải trí", "Mua sắm", "Học tập", "Sức khỏe", "Nhà ở", "Khác"]
SAVING  = ["Khẩn cấp", "Đồ công nghệ", "Du lịch", "Quà tặng", "Nhà ở", "Di chuyển", "Cá nhân", "Khác"]

def _ensure(conn, name: str, type_: str):
    conn.execute(
        sa.text("""
            INSERT INTO categories (name, type, user_id)
            SELECT :name, :type, NULL
            WHERE NOT EXISTS (
                SELECT 1 FROM categories
                WHERE name = :name AND type = :type AND user_id IS NULL
            )
        """),
        {"name": name, "type": type_}
    )

def upgrade():
    conn = op.get_bind()
    for n in EXPENSE:
        _ensure(conn, n, "expense")
    for n in SAVING:
        _ensure(conn, n, "saving")

def downgrade():
    # an toàn: chỉ xoá các seed chung (user_id IS NULL), không đụng income/saving/expense của người dùng
    conn = op.get_bind()
    for n in EXPENSE:
        conn.execute(sa.text(
            "DELETE FROM categories WHERE name=:name AND type='expense' AND user_id IS NULL"
        ), {"name": n})
    for n in SAVING:
        conn.execute(sa.text(
            "DELETE FROM categories WHERE name=:name AND type='saving' AND user_id IS NULL"
        ), {"name": n})