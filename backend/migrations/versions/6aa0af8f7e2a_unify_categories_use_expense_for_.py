"""Unify categories: use expense for budgets + add unique index

Revision ID: 6aa0af8f7e2a
Revises: adb0491be726
Create Date: 2025-10-18 21:52:30.347699

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6aa0af8f7e2a'
down_revision = 'adb0491be726'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # 1) Bật FK cho SQLite (phòng trường hợp connection chưa bật)
    conn.execute(sa.text("PRAGMA foreign_keys=ON"))

    # 2) Map budgets.category_id (đang trỏ type='budget') sang id của type='expense' cùng tên
    #    Dùng CTE để tránh phải tạo temp table
    conn.execute(sa.text("""
    WITH map AS (
      SELECT cb.id AS budget_cat_id, e.id AS expense_cat_id
      FROM categories cb
      JOIN categories e
        ON lower(e.name) = lower(cb.name)
       AND e.type = 'expense'
     WHERE cb.type = 'budget'
    )
    UPDATE budgets
       SET category_id = (
         SELECT expense_cat_id FROM map
          WHERE map.budget_cat_id = budgets.category_id
       )
     WHERE EXISTS (
         SELECT 1 FROM map
          WHERE map.budget_cat_id = budgets.category_id
     );
    """))

    # 3) Xoá các category type='budget' (đã map xong)
    conn.execute(sa.text("DELETE FROM categories WHERE type='budget';"))

    # 4) Thêm unique index để tránh trùng tên theo type (SQLite cho phép index expression)
    conn.execute(sa.text("""
    CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_name_type
      ON categories (lower(name), type);
    """))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("PRAGMA foreign_keys=ON"))

    # Gỡ unique index (nếu cần rollback)
    conn.execute(sa.text("DROP INDEX IF EXISTS ux_categories_name_type"))

    # Không thể tự restore lại các bản ghi type='budget' đã xóa (không có thông tin).
    # Nếu cần, bạn có thể chèn lại thủ công tùy dữ liệu.
