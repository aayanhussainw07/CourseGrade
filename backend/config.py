import importlib.util
import os


def _postgres_driver_available() -> bool:
    return bool(importlib.util.find_spec("psycopg2") or importlib.util.find_spec("psycopg"))


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        if not _postgres_driver_available():
            raise RuntimeError(
                "PostgreSQL driver missing. Install dependencies with "
                "`pip install -r backend/requirements.txt` "
                "(or at minimum `pip install psycopg2-binary`)."
            )
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        if not _postgres_driver_available():
            raise RuntimeError(
                "PostgreSQL driver missing. Install dependencies with "
                "`pip install -r backend/requirements.txt` "
                "(or at minimum `pip install psycopg2-binary`)."
            )
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Supabase connections require SSL.
    if "supabase.co" in url and "sslmode=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"

    return url


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not database_url:
        return "sqlite:///db.sqlite3"
    return _normalize_database_url(database_url)


def get_cors_origins() -> list[str]:
    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://coursegrade.vercel.app",
        "https://course-grade.vercel.app",
    ]
    origins = os.getenv("FLASK_CORS_ALLOWED_ORIGINS", ",".join(default_origins))
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


class Config:
    SQLALCHEMY_DATABASE_URI = get_database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    AUTO_CREATE_TABLES = os.getenv("AUTO_CREATE_TABLES", "true").lower() in {"1", "true", "yes"}
