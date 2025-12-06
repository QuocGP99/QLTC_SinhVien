"""add savings history + auto fields

Revision ID: 965787f08369
Revises: 05eace8b6f8b
Create Date: 2025-10-31 00:37:11.870976

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '965787f08369'
down_revision = '05eace8b6f8b'
branch_labels = None
depends_on = None


def upgrade():
    # 1) thêm cột vào savings_goals
    op.add_column(
        "savings_goals",
        sa.Column("auto_contribute", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "savings_goals",
        sa.Column("contribute_interval", sa.String(length=8), nullable=False, server_default="monthly"),
    )

    # 2) tạo bảng lịch sử
    op.create_table(
        "savings_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),

        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("method", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("interval", sa.String(length=8), nullable=False, server_default="monthly"),
        sa.Column("note", sa.Text()),

        sa.ForeignKeyConstraint(["goal_id"], ["savings_goals.id"], onupdate="CASCADE", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], onupdate="CASCADE", ondelete="CASCADE"),
    )
    op.create_index("idx_savhist_user", "savings_history", ["user_id"])
    op.create_index("idx_savhist_goal", "savings_history", ["goal_id"])
    op.create_index("idx_savhist_created", "savings_history", ["created_at"])

    # bỏ default để DB sạch
    op.alter_column("savings_goals", "auto_contribute", server_default=None)
    op.alter_column("savings_goals", "contribute_interval", server_default=None)


def downgrade():
    op.drop_index("idx_savhist_created", table_name="savings_history")
    op.drop_index("idx_savhist_goal", table_name="savings_history")
    op.drop_index("idx_savhist_user", table_name="savings_history")
    op.drop_table("savings_history")

    op.drop_column("savings_goals", "contribute_interval")
    op.drop_column("savings_goals", "auto_contribute")