"""merge heads: categories allow saving

Revision ID: 0c8b98a57ed0
Revises: 6845f34f6643, 1d47cb19c060_categories_allow_type_saving
Create Date: 2025-10-16 00:10:56.996602

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0c8b98a57ed0'
down_revision = ('6845f34f6643', '1d47cb19c060_categories_allow_type_saving')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
