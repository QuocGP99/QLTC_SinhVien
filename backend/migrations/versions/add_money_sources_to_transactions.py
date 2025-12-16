"""Add money_source_id to expenses and incomes

Revision ID: add_money_sources_to_transactions
Revises: add_money_sources
Create Date: 2025-12-16 11:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_money_sources_to_transactions"
down_revision = "add_money_sources"
branch_labels = None
depends_on = None


def upgrade():
    # Add column to expenses
    op.add_column("expenses", sa.Column("money_source_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_expenses_money_source_id"),
        "expenses",
        ["money_source_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_expenses_money_source_id",
        "expenses",
        "money_sources",
        ["money_source_id"],
        ["id"],
        onupdate="CASCADE",
        ondelete="SET NULL",
    )

    # Add column to incomes
    op.add_column("incomes", sa.Column("money_source_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_incomes_money_source_id"), "incomes", ["money_source_id"], unique=False
    )
    op.create_foreign_key(
        "fk_incomes_money_source_id",
        "incomes",
        "money_sources",
        ["money_source_id"],
        ["id"],
        onupdate="CASCADE",
        ondelete="SET NULL",
    )


def downgrade():
    # Drop from incomes
    op.drop_constraint("fk_incomes_money_source_id", "incomes", type_="foreignkey")
    op.drop_index(op.f("ix_incomes_money_source_id"), table_name="incomes")
    op.drop_column("incomes", "money_source_id")

    # Drop from expenses
    op.drop_constraint("fk_expenses_money_source_id", "expenses", type_="foreignkey")
    op.drop_index(op.f("ix_expenses_money_source_id"), table_name="expenses")
    op.drop_column("expenses", "money_source_id")
