"""rebuild categories check to allow budget

Revision ID: aa4cd9eab12f
Revises: 8141d1f7e30f
Create Date: 2025-10-16 01:32:04.392563

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aa4cd9eab12f'
down_revision = '2cd2d72451de'
branch_labels = None
depends_on = None


def upgrade():
    """
    Rebuild bảng categories để thay CHECK constraint, cho phép type='budget'.
    Batch mode sẽ tạo bảng tạm, copy data, rồi rename -> dữ liệu an toàn.
    """
    with op.batch_alter_table("categories", recreate="always") as batch_op:
        # các cột giữ nguyên kiểu/nullable theo model hiện tại
        batch_op.alter_column("name", existing_type=sa.String(length=120), nullable=False)
        batch_op.alter_column("type", existing_type=sa.String(length=20), nullable=False)
        batch_op.alter_column("color_hex", existing_type=sa.String(length=16), nullable=True)
        batch_op.alter_column("icon_key", existing_type=sa.String(length=64), nullable=True)
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)

        # tạo lại UNIQUE (user_id, name, type)
        batch_op.create_unique_constraint(
            "uq_categories_user_name_type", ["user_id", "name", "type"]
        )

        # CHECK mới: thêm 'budget'
        batch_op.create_check_constraint(
            "ck_category_type",
            "type IN ('expense','income','saving','budget')"
        )

    # tạo lại index user_id nếu bạn cần (SQLite không có IF NOT EXISTS qua op)
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("CREATE INDEX IF NOT EXISTS ix_categories_user_id ON categories (user_id)")
    else:
        op.create_index("ix_categories_user_id", "categories", ["user_id"], unique=False)

def downgrade():
    """
    Quay lại CHECK cũ (không có 'budget').
    """
    with op.batch_alter_table("categories", recreate="always") as batch_op:
        batch_op.alter_column("name", existing_type=sa.String(length=120), nullable=False)
        batch_op.alter_column("type", existing_type=sa.String(length=20), nullable=False)
        batch_op.alter_column("color_hex", existing_type=sa.String(length=16), nullable=True)
        batch_op.alter_column("icon_key", existing_type=sa.String(length=64), nullable=True)
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)

        batch_op.create_unique_constraint(
            "uq_categories_user_name_type", ["user_id", "name", "type"]
        )
        batch_op.create_check_constraint(
            "ck_category_type",
            "type IN ('expense','income','saving')"
        )

    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("DROP INDEX IF EXISTS ix_categories_user_id")
        op.execute("CREATE INDEX IF NOT EXISTS ix_categories_user_id ON categories (user_id)")
    else:
        # tùy môi trường, có thể phải drop và tạo lại
        pass
