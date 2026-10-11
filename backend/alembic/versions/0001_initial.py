"""initial schema with exclusion constraint

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


user_role = postgresql.ENUM("client", "admin", name="user_role", create_type=False)
reservation_status = postgresql.ENUM(
    "pending_payment",
    "confirmed",
    "cancelled_timeout",
    "cancelled_user",
    "cancelled_admin",
    "completed",
    name="reservation_status",
    create_type=False,
)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    user_role.create(op.get_bind(), checkfirst=True)
    reservation_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=120)),
        sa.Column("phone", sa.String(length=32)),
        sa.Column("avatar_key", sa.String(length=512)),
        sa.Column(
            "role",
            user_role,
            nullable=False,
            server_default="client",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_phone", "users", ["phone"])

    op.create_table(
        "tables",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(length=16), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.UniqueConstraint("number", name="uq_tables_number"),
    )

    op.create_table(
        "menu_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.UniqueConstraint("name", name="uq_menu_categories_name"),
    )

    op.create_table(
        "menu_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("menu_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("image_key", sa.String(length=512)),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.create_index("ix_menu_items_category_id", "menu_items", ["category_id"])

    op.create_table(
        "reservations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "table_id",
            sa.Integer(),
            sa.ForeignKey("tables.id"),
            nullable=False,
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("guests_count", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            reservation_status,
            nullable=False,
            server_default="pending_payment",
        ),
        sa.Column("deposit_amount", sa.Integer(), nullable=False),
        sa.Column("payment_id", sa.String(length=255)),
        sa.Column("payment_provider", sa.String(length=32)),
        sa.Column("hold_expires_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "time_range",
            postgresql.TSTZRANGE(),
            sa.Computed("tstzrange(start_time, end_time, '[)')", persisted=True),
            nullable=False,
        ),
    )
    op.create_index("ix_reservations_user_id", "reservations", ["user_id"])
    op.create_index("ix_reservations_table_id", "reservations", ["table_id"])
    op.create_index(
        "ix_reservations_pending_expiry",
        "reservations",
        ["hold_expires_at"],
        postgresql_where=sa.text("status = 'pending_payment'"),
    )
    op.create_index(
        "ix_reservations_payment_id",
        "reservations",
        ["payment_id"],
    )

    op.execute(
        """
        ALTER TABLE reservations
        ADD CONSTRAINT ex_reservations_no_overlap
        EXCLUDE USING gist (
            table_id WITH =,
            time_range WITH &&
        )
        WHERE (status IN ('pending_payment', 'confirmed'))
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE reservations DROP CONSTRAINT IF EXISTS ex_reservations_no_overlap")
    op.drop_index("ix_reservations_payment_id", table_name="reservations")
    op.drop_index("ix_reservations_pending_expiry", table_name="reservations")
    op.drop_index("ix_reservations_table_id", table_name="reservations")
    op.drop_index("ix_reservations_user_id", table_name="reservations")
    op.drop_table("reservations")

    op.drop_index("ix_menu_items_category_id", table_name="menu_items")
    op.drop_table("menu_items")
    op.drop_table("menu_categories")

    op.drop_table("tables")

    op.drop_index("ix_users_phone", table_name="users")
    op.drop_table("users")

    reservation_status.drop(op.get_bind(), checkfirst=True)
    user_role.drop(op.get_bind(), checkfirst=True)