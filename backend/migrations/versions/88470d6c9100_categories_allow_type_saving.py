from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "1d47cb19c060_categories_allow_type_saving"   # đổi theo file của bạn
down_revision = "1d47cb19c060"             # sửa thành id revision trước đó
branch_labels = None
depends_on = None

def upgrade():
    # SQLite không sửa CHECK trực tiếp, nên recreate bảng để áp dụng CHECK mới
    with op.batch_alter_table("categories", recreate="always") as batch_op:
        # (Tùy engine) drop constraint cũ nếu có thể; recreate sẽ áp rule mới
        try:
            batch_op.drop_constraint("ck_category_type", type_="check")
        except Exception:
            pass
        batch_op.create_check_constraint(
            "ck_category_type",
            "type IN ('expense','income','saving')"
        )
        # UniqueConstraint đã được định nghĩa trong schema; recreate="always" sẽ giữ lại
        # Nếu dự án của bạn không autoload UniqueConstraint, có thể thêm:
        # batch_op.create_unique_constraint(
        #     "uq_categories_user_name_type", ["user_id", "name", "type"]
        # )

def downgrade():
    with op.batch_alter_table("categories", recreate="always") as batch_op:
        try:
            batch_op.drop_constraint("ck_category_type", type_="check")
        except Exception:
            pass
        batch_op.create_check_constraint(
            "ck_category_type",
            "type IN ('expense','income')"
        )
