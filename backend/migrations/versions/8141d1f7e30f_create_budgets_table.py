"""create budgets table

Revision ID: 8141d1f7e30f
Revises: 2cd2d72451de
Create Date: 2025-10-16 01:08:10.174168

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8141d1f7e30f'
down_revision = '2cd2d72451de'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("categories.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False),
        sa.Column("period_year", sa.Integer, nullable=False),
        sa.Column("period_month", sa.Integer, nullable=False),
        sa.Column("limit_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("note", sa.Text),

        sa.UniqueConstraint("user_id", "category_id", "period_year", "period_month", name="uq_budget_user_cat_year_month"),
        sa.CheckConstraint("period_month BETWEEN 1 AND 12", name="ck_budget_month_1_12"),
        sa.CheckConstraint("limit_amount > 0", name="ck_budget_limit_pos"),
    )
    op.create_index("idx_budgets_user_period", "budgets", ["user_id", "period_year", "period_month"], unique=False)
    op.create_index("ix_budgets_user_id", "budgets", ["user_id"], unique=False)
    op.create_index("ix_budgets_category_id", "budgets", ["category_id"], unique=False)

def downgrade():
    op.drop_index("ix_budgets_category_id", table_name="budgets")
    op.drop_index("ix_budgets_user_id", table_name="budgets")
    op.drop_index("idx_budgets_user_period", table_name="budgets")
    op.drop_table("budgets")
