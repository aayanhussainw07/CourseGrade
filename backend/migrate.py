from __future__ import annotations

import sys

from app import create_app
from extensions import db
from models import GradeScale
from routes import DEFAULT_GRADE_SCALES


def run_migrations() -> None:
    app = create_app()
    with app.app_context():
        db.create_all()

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
