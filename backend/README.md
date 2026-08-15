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
pip install -r ../requirements.txt
```

## 2) Configure env

Copy `.env.example` values into your environment (or `.env`):

- `DATABASE_URL` or `SUPABASE_DB_URL`: Supabase Postgres connection string
- `FLASK_CORS_ALLOWED_ORIGINS`: comma-separated frontend origins
- `INTERNAL_API_SECRET`: shared secret required by the Next.js proxy
- `AUTO_CREATE_TABLES=true` for local quick start only

The sole platform admin is intentionally fixed in `routes.py` and mirrors the
canonical frontend value in `lib/is-admin.ts`.

## 3) Run (dev)

```bash
cd backend
source venv/bin/activate
flask --app app.py run --host 0.0.0.0 --port 8000
```

The frontend browser client talks to the same-origin Next.js proxy at
`/api/backend/*`. The proxy points to `http://localhost:8000/api` by default.
Set the same random secret in the frontend as `BACKEND_INTERNAL_API_SECRET`.
Both services refuse requests or startup when the secret is missing or shorter
than 32 characters; there is no fallback credential.

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
