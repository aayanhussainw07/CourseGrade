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


def run_migrations() -> None:
    app = create_app()
    with app.app_context():
        db.create_all()
        _ensure_feedback_completed_column()
        _ensure_course_header_color_column()
        _ensure_semester_ignored_column()

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
