"""add is_verified and otp_verifications

Revision ID: 7c998bde100e
Revises: b2959b780a3c
Create Date: 2025-10-28 11:38:25.897191

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '7c998bde100e'
down_revision = 'b2959b780a3c'
branch_labels = None
depends_on = None


def upgrade():
    # Chuẩn hoá dữ liệu user cũ: nếu có user nào NULL is_verified thì set = 0
    op.execute("UPDATE users SET is_verified = 0 WHERE is_verified IS NULL;")

def downgrade():
    # downgrade bỏ trống vì ta không muốn rollback cột / xóa bảng đã có
    pass