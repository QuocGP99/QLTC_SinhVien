"""merge heads

Revision ID: da0c6c8cfbb4
Revises: 6aa0af8f7e2a, 20251021_add_income_categories
Create Date: 2025-10-21 03:38:49.393484

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'da0c6c8cfbb4'
down_revision = ('6aa0af8f7e2a', '20251021_add_income_categories')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
