from flask_sqlalchemy import SQLAlchemy


try:
    from flask_migrate import Migrate
except ModuleNotFoundError:
    class Migrate:  # type: ignore[override]
        """Fallback shim so app startup does not fail without flask-migrate."""

        def init_app(self, app, db):
            app.logger.warning(
                "flask_migrate is not installed. "
                "Use python3 migrate.py for schema creation, "
                "or install Flask-Migrate for 'flask db' commands."
            )

# Shared extension instances. They are bound in create_app().
db = SQLAlchemy()
migrate = Migrate()
