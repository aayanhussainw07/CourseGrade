import os

from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import inspect, text
from werkzeug.exceptions import HTTPException

from env_loader import load_backend_env

load_backend_env()

from config import Config, get_cors_origins
from extensions import db, migrate
from routes import api


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


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)

    cors_origins = get_cors_origins()
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins if cors_origins else "*"}},
        supports_credentials=True,
        allow_headers=[
            "Accept",
            "Accept-Encoding",
            "Authorization",
            "Content-Type",
            "DNT",
            "Origin",
            "User-Agent",
            "X-CSRFToken",
            "X-Requested-With",
            "X-User-Id",
        ],
        methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    )

    app.register_blueprint(api)

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        return jsonify({"detail": error.description}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error: Exception):
        app.logger.exception("Unhandled exception: %s", error)
        return jsonify({"detail": "Internal server error."}), 500

    if app.config.get("AUTO_CREATE_TABLES", False):
        with app.app_context():
            db.create_all()
            _ensure_feedback_completed_column()

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        debug=os.getenv("FLASK_DEBUG", "0") in {"1", "true", "True"},
    )
