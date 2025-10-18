"""categories constraints & indexes

Revision ID: 2cd2d72451de
Revises: 0c8b98a57ed0
Create Date: 2025-10-16 01:03:34.797611

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2cd2d72451de'
down_revision = '0c8b98a57ed0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    if is_sqlite:
        # SQLite: dùng UNIQUE INDEX thay cho UNIQUE CONSTRAINT
        op.create_index(
            "uq_category_scope_type_name", "categories",
            ["user_id", "type", "name"], unique=True
        )
    else:
        op.create_unique_constraint(
            "uq_category_scope_type_name", "categories",
            ["user_id", "type", "name"]
        )

    # INDEX phục vụ query (cả SQLite lẫn các DB khác đều OK)
    op.create_index(
        "idx_categories_user_type", "categories",
        ["user_id", "type"], unique=False
    )

    # DATA FIX: chuẩn hoá tên
    op.execute(sa.text("""
        UPDATE categories
        SET name = 'Sức khỏe'
        WHERE name IN ('Sức khoẻ', 'Suc khoe', 'Suc khoẻ');
    """))

def downgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # xoá index/constraint theo cách đã tạo ở upgrade
    op.drop_index("idx_categories_user_type", table_name="categories")

    if is_sqlite:
        op.drop_index("uq_category_scope_type_name", table_name="categories")
    else:
        op.drop_constraint(
            "uq_category_scope_type_name", "categories", type_="unique"
        )