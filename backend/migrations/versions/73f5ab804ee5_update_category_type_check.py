"""update_category_type_check

Revision ID: 73f5ab804ee5
Revises: 6aa0af8f7e2a
Create Date: 2025-10-21 03:30:38.451029

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '73f5ab804ee5'
down_revision = '6aa0af8f7e2a'
branch_labels = None
depends_on = None


"""Make sure 'income' categories exist; skip schema changes on SQLite"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20251021_add_income_categories"
down_revision = None  # hoặc đặt revision trước đó của bạn
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    dialect = conn.dialect.name

    # --- Seed danh mục 'income' (idempotent) ---
    existing = set(
        r[0]
        for r in conn.execute(sa.text(
            "SELECT name FROM categories WHERE type = 'income'"
        ))
    )

    need = ["Lương", "Học bổng", "Thưởng", "Khác"]
    to_add = [n for n in need if n not in existing]

    if to_add:
        # SQLite/PG/MySQL đều OK
        for name in to_add:
            conn.execute(sa.text(
                """
                INSERT INTO categories (name, type, user_id)
                VALUES (:name, 'income', NULL)
                """
            ), {"name": name})

    # --- (Tuỳ CSDL) Sửa constraint chỉ khi KHÔNG phải SQLite ---
    if dialect != "sqlite":
        # Ví dụ cho Postgres: đảm bảo có giá trị 'income'
        # Try/catch để tránh lỗi nếu constraint đã tồn tại đúng
        try:
            op.drop_constraint("ck_category_type", "categories", type_="check")
        except Exception:
            pass
        op.create_check_constraint(
            "ck_category_type",
            "categories",
            "type IN ('expense','income','saving','budget')",
        )


def downgrade():
    # Không xoá schema; chỉ xoá seed nếu muốn
    conn = op.get_bind()
    conn.execute(sa.text(
        "DELETE FROM categories WHERE type = 'income' AND user_id IS NULL"
    ))
