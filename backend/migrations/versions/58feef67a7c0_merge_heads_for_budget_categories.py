"""merge heads for budget categories

Revision ID: 58feef67a7c0
Revises: 8141d1f7e30f, aa4cd9eab12f
Create Date: 2025-10-16 01:34:11.792360

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '58feef67a7c0'
down_revision = ('8141d1f7e30f', 'aa4cd9eab12f')
branch_labels = None
depends_on = None


def upgrade():
    # Tái tạo bảng để thay CHECK: thêm 'budget'
    with op.batch_alter_table("categories", recreate="always") as b:
        b.alter_column("name", existing_type=sa.String(120), nullable=False)
        b.alter_column("type", existing_type=sa.String(20),  nullable=False)
        b.alter_column("color_hex", existing_type=sa.String(16), nullable=True)
        b.alter_column("icon_key", existing_type=sa.String(64), nullable=True)
        b.alter_column("user_id",  existing_type=sa.Integer(),   nullable=True)

        # unique (user_id, name, type)
        b.create_unique_constraint("uq_categories_user_name_type", ["user_id","name","type"])
        # CHECK mới
        b.create_check_constraint("ck_category_type", "type IN ('expense','income','saving','budget')")

    # (tuỳ) tạo lại index user_id
    op.execute("CREATE INDEX IF NOT EXISTS ix_categories_user_id ON categories (user_id)")

def downgrade():
    with op.batch_alter_table("categories", recreate="always") as b:
        b.alter_column("name", existing_type=sa.String(120), nullable=False)
        b.alter_column("type", existing_type=sa.String(20),  nullable=False)
        b.alter_column("color_hex", existing_type=sa.String(16), nullable=True)
        b.alter_column("icon_key", existing_type=sa.String(64), nullable=True)
        b.alter_column("user_id",  existing_type=sa.Integer(),   nullable=True)

        b.create_unique_constraint("uq_categories_user_name_type", ["user_id","name","type"])
        b.create_check_constraint("ck_category_type", "type IN ('expense','income','saving')")

    op.execute("DROP INDEX IF EXISTS ix_categories_user_id")