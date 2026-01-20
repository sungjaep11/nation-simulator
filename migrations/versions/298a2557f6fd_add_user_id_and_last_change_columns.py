"""add user_id and last_change columns

Revision ID: 298a2557f6fd
Revises: 5b0205e5c069
Create Date: 2026-01-20 07:29:41.992980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '298a2557f6fd'
down_revision: Union[str, Sequence[str], None] = '5b0205e5c069'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Use batch operations for SQLite compatibility
    with op.batch_alter_table('country') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_country_user_id_user', 'user', ['user_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('country') as batch_op:
        batch_op.drop_constraint('fk_country_user_id_user', type_='foreignkey')
        batch_op.drop_column('user_id')
