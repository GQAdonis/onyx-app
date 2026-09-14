"""Add chat_session__document_set for conversation-level document-set scope

Revision ID: a1f4c9e27b03
Revises: 287021f3b46c
Create Date: 2026-09-14

A conversation-level document-set scope, distinct from the persona's configured
knowledge (persona__document_set). Both FKs cascade: deleting a chat session or
a document set removes the scope rows rather than orphaning them.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a1f4c9e27b03"
down_revision = "287021f3b46c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_session__document_set",
        sa.Column(
            "chat_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_session.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "document_set_id",
            sa.Integer(),
            sa.ForeignKey("document_set.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("chat_session__document_set")
