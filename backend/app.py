import os
import hmac

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from env_loader import load_backend_env

load_backend_env()

from config import Config, get_cors_origins
from extensions import db, migrate
from routes import api, record_user_activity


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
            "X-Internal-Api-Secret",
            "X-User-Email",
            "X-User-Id",
        ],
        methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    )

    app.register_blueprint(api)

    @app.before_request
    def require_internal_api_secret():
        if not request.path.startswith("/api/"):
            return None
        if request.path == "/api/health/" or request.method == "OPTIONS":
            return None

        expected_secret = app.config.get("INTERNAL_API_SECRET", "")
        provided_secret = request.headers.get("X-Internal-Api-Secret", "")
        if not expected_secret or not hmac.compare_digest(provided_secret, expected_secret):
            return jsonify({"detail": "Unauthorized."}), 401

        return None

    @app.before_request
    def track_user_activity():
        # Runs only after the secret check passes (Flask stops on its 401).
        if not request.path.startswith("/api/"):
            return None
        if request.path == "/api/health/" or request.method == "OPTIONS":
            return None
        record_user_activity(request.headers.get("X-User-Id", "").strip())
        return None

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

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        debug=os.getenv("FLASK_DEBUG", "0") in {"1", "true", "True"},
    )
