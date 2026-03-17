# CourseGrade Backend (Flask + Supabase Postgres)

This backend exposes the same REST contract your frontend already uses:

- `GET/POST /api/semesters/`
- `GET/PATCH/DELETE /api/semesters/<id>/`
- `POST /api/semesters/<id>/duplicate/`
- `GET/POST /api/courses/`
- `GET/PATCH/DELETE /api/courses/<id>/`
- `GET/POST /api/assignments/`
- `GET/PATCH/DELETE /api/assignments/<id>/`
- `GET/POST /api/grade-scales/`
- `GET/PATCH/DELETE /api/grade-scales/<id>/`
- `POST /api/grade-scales/reset_default/`

## 1) Install

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 2) Configure env

Copy `.env.example` values into your environment (or `.env`):

- `DATABASE_URL` or `SUPABASE_DB_URL`: Supabase Postgres connection string
- `FLASK_CORS_ALLOWED_ORIGINS`: comma-separated frontend origins
- `AUTO_CREATE_TABLES=true` for quick start

## 3) Run (dev)

```bash
cd backend
source venv/bin/activate
flask --app app.py run --host 0.0.0.0 --port 8000
```

Frontend default already points to `http://localhost:8000/api`.

## 4) Run (production)

```bash
gunicorn -w 2 -b 0.0.0.0:8000 wsgi:app
```

## 5) Optional migrations (recommended for production)

```bash
flask --app app.py db init
flask --app app.py db migrate -m "initial schema"
flask --app app.py db upgrade
```

If `flask_migrate` is not installed, use:

```bash
python3 migrate.py
```
