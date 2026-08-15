from __future__ import annotations

import sys

from sqlalchemy import inspect, text

from app import create_app
from extensions import db
from models import GradeScale
from routes import DEFAULT_GRADE_SCALES


def _ensure_feedback_completed_column() -> None:
    inspector = inspect(db.engine)
    if "feedback" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("feedback")}
    if "completed" in columns:
        return

    default_value = "0" if db.engine.dialect.name == "sqlite" else "false"
    db.session.execute(
        text(
            "ALTER TABLE feedback "
            f"ADD COLUMN completed BOOLEAN NOT NULL DEFAULT {default_value}"
        )
    )
    db.session.commit()


def _ensure_course_header_color_column() -> None:
    inspector = inspect(db.engine)
    if "courses" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("courses")}
    if "header_color" in columns:
        return

    db.session.execute(text("ALTER TABLE courses ADD COLUMN header_color VARCHAR(32)"))
    db.session.commit()


def _ensure_semester_ignored_column() -> None:
    inspector = inspect(db.engine)
    if "semesters" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("semesters")}
    if "ignored" in columns:
        return

    default_value = "0" if db.engine.dialect.name == "sqlite" else "false"
    db.session.execute(
        text(
            "ALTER TABLE semesters "
            f"ADD COLUMN ignored BOOLEAN NOT NULL DEFAULT {default_value}"
        )
    )
    db.session.commit()


def _ensure_cloud_persistence_columns() -> None:
    """Backfill the cloud-persistence schema for existing local databases.

    Production schema changes live in the Supabase migration. This compatibility
    path keeps SQLite development databases and older self-hosted databases usable.
    """
    inspector = inspect(db.engine)
    table_names = set(inspector.get_table_names())
    dialect = db.engine.dialect.name
    json_type = "JSONB" if dialect == "postgresql" else "JSON"

    additions = {
        "semesters": {
            "sort_order": "INTEGER NOT NULL DEFAULT 0",
        },
        "courses": {
            "sort_order": "INTEGER NOT NULL DEFAULT 0",
            "pass_label": "VARCHAR(24)",
            "fail_label": "VARCHAR(24)",
            "pass_threshold": "FLOAT",
            "letter_grade_scale": json_type,
        },
        "assignments": {
            "client_id": "VARCHAR(64)",
            "sort_order": "INTEGER NOT NULL DEFAULT 0",
            "extra_credit": "FLOAT",
            "sub_items": json_type,
        },
        "user_settings": {
            "dashboard_message": "VARCHAR(240)",
            "last_active_semester_id": "INTEGER",
            "local_migration_version": "INTEGER NOT NULL DEFAULT 0",
        },
    }

    for table_name, columns_to_add in additions.items():
        if table_name not in table_names:
            continue
        existing = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name, definition in columns_to_add.items():
            if column_name not in existing:
                db.session.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
                )

    if "assignments" in table_names:
        db.session.execute(
            text("UPDATE assignments SET client_id = CAST(id AS VARCHAR) WHERE client_id IS NULL")
        )

    index_statements = (
        "CREATE INDEX IF NOT EXISTS ix_semesters_user_sort ON semesters (user_id, sort_order, id)",
        "CREATE INDEX IF NOT EXISTS ix_courses_semester_sort ON courses (semester_id, sort_order, id)",
        "CREATE INDEX IF NOT EXISTS ix_assignments_course_sort ON assignments (course_id, sort_order, id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_assignments_course_client_id ON assignments (course_id, client_id)",
    )
    for statement in index_statements:
        db.session.execute(text(statement))

    if dialect == "postgresql":
        for table_name in (
            "semesters",
            "courses",
            "assignments",
            "user_settings",
            "legacy_local_backups",
        ):
            if table_name in table_names or table_name == "legacy_local_backups":
                db.session.execute(text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY"))
                db.session.execute(
                    text(f"REVOKE ALL ON TABLE {table_name} FROM anon, authenticated")
                )

    db.session.commit()


def run_migrations() -> None:
    app = create_app()
    with app.app_context():
        db.create_all()
        _ensure_feedback_completed_column()
        _ensure_course_header_color_column()
        _ensure_semester_ignored_column()
        _ensure_cloud_persistence_columns()

        # Seed grade scale defaults once for a brand-new database.
        if GradeScale.query.count() == 0:
            db.session.add_all([GradeScale(**scale) for scale in DEFAULT_GRADE_SCALES])
            db.session.commit()
            print("Migrations complete. Seeded default grade scales.")
        else:
            print("Migrations complete.")


if __name__ == "__main__":
    try:
        run_migrations()
    except Exception as error:
        print(f"Migration failed: {error}", file=sys.stderr)
        raise
