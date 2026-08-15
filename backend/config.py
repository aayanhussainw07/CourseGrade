import importlib.util
import os

from security_limits import MAX_BACKEND_BODY_BYTES


def _postgres_driver_available() -> bool:
    return bool(importlib.util.find_spec("psycopg2") or importlib.util.find_spec("psycopg"))


def _is_production() -> bool:
    return os.getenv("FLASK_ENV", "").lower() == "production" or os.getenv("ENV", "").lower() == "production"


def _normalize_database_url(url: str, env_var: str) -> str:
    if url.startswith(("http://", "https://")):
        raise RuntimeError(
            f"{env_var} must be a database connection string, not an HTTP URL. "
            "Use the Supabase Postgres connection string from Project Settings > Database."
        )

    if url.startswith("postgres://"):
        if not _postgres_driver_available():
            raise RuntimeError(
                "PostgreSQL driver missing. Install dependencies with "
                "`pip install -r requirements.txt` "
                "(or at minimum `pip install psycopg2-binary`)."
            )
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        if not _postgres_driver_available():
            raise RuntimeError(
                "PostgreSQL driver missing. Install dependencies with "
                "`pip install -r requirements.txt` "
                "(or at minimum `pip install psycopg2-binary`)."
            )
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Supabase connections require SSL.
    if "supabase.co" in url and "sslmode=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"

    return url


def get_database_url() -> str:
    env_var = "DATABASE_URL"
    database_url = os.getenv(env_var)
    if not database_url:
        env_var = "SUPABASE_DB_URL"
        database_url = os.getenv(env_var)
    if not database_url:
        return "sqlite:///db.sqlite3"
    return _normalize_database_url(database_url, env_var)


def get_cors_origins() -> list[str]:
    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://coursegrade.io",
        "https://coursegrade.vercel.app",
        "https://course-grade.vercel.app",
    ]
    origins = os.getenv("FLASK_CORS_ALLOWED_ORIGINS", ",".join(default_origins))
    parsed = [origin.strip() for origin in origins.split(",") if origin.strip()]
    if _is_production() and not parsed:
        raise RuntimeError("FLASK_CORS_ALLOWED_ORIGINS must be set in production.")
    if _is_production() and "*" in parsed:
        raise RuntimeError("FLASK_CORS_ALLOWED_ORIGINS cannot include '*' in production.")
    return parsed


def get_internal_api_secret() -> str:
    secret = os.getenv("INTERNAL_API_SECRET", "").strip()
    if len(secret) < 32:
        raise RuntimeError(
            "INTERNAL_API_SECRET is required and must contain at least 32 characters."
        )
    return secret


class Config:
    SQLALCHEMY_DATABASE_URI = get_database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    AUTO_CREATE_TABLES = os.getenv("AUTO_CREATE_TABLES", "false").lower() in {"1", "true", "yes"}
    INTERNAL_API_SECRET = get_internal_api_secret()
    MAX_CONTENT_LENGTH = MAX_BACKEND_BODY_BYTES
