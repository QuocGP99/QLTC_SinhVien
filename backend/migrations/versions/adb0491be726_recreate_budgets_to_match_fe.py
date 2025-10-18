"""recreate_budgets_to_match_fe

Revision ID: adb0491be726
Revises: 9771022f0b57
Create Date: 2025-10-16 03:34:13.500943

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'adb0491be726'
down_revision = '9771022f0b57'
branch_labels = None
depends_on = None


def upgrade():
    # Xoá bảng cũ (nếu tồn tại) bằng batch recreate để an toàn với SQLite
    with op.batch_alter_table("budgets", recreate="always") as b:
        # định nghĩa lại các cột đúng FE + model
        b.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
        b.alter_column("category_id", existing_type=sa.Integer(), nullable=False)
        b.alter_column("period_year", existing_type=sa.Integer(), nullable=False)
        b.alter_column("period_month", existing_type=sa.Integer(), nullable=False)
        b.alter_column("limit_amount", existing_type=sa.Numeric(12, 2), nullable=False)
        # tuỳ: ghi chú
        try:
            b.alter_column("note", existing_type=sa.Text(), nullable=True)
        except Exception:
            pass

        # Unique & Check & Index theo model
        b.create_unique_constraint(
            "uq_budget_user_cat_year_month",
            ["user_id", "category_id", "period_year", "period_month"]
        )
        b.create_check_constraint(
            "ck_budget_month_1_12",
            "period_month BETWEEN 1 AND 12"
        )
        b.create_check_constraint(
            "ck_budget_limit_pos",
            "limit_amount > 0"
        )

    # Index tổng hợp (user + period) – nếu recreate không giữ lại index
    op.execute("CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON budgets (user_id, period_year, period_month);")
    # Index đơn cột cho FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_budgets_user_id ON budgets (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_budgets_category_id ON budgets (category_id);")

def downgrade():
    # Trả về trạng thái trước (tối thiểu: bỏ constraint mới tạo)
    with op.batch_alter_table("budgets", recreate="always") as b:
        try:
            b.drop_constraint("uq_budget_user_cat_year_month", type_="unique")
        except Exception:
            pass
        try:
            b.drop_constraint("ck_budget_month_1_12", type_="check")
        except Exception:
            pass
        try:
            b.drop_constraint("ck_budget_limit_pos", type_="check")
        except Exception:
            pass