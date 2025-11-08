# Django + React Setup Guide

This guide will help you set up and run the CourseGrade application with Django backend and React frontend.

## Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher
- pip (Python package manager)
- npm or yarn

## Backend Setup (Django)

### 1. Navigate to Backend Directory

\`\`\`bash
cd backend
\`\`\`

### 2. Create Virtual Environment

**Windows:**
\`\`\`bash
python -m venv venv
venv\Scripts\activate
\`\`\`

**Mac/Linux:**
\`\`\`bash
python3 -m venv venv
source venv/bin/activate
\`\`\`

### 3. Install Dependencies

\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 4. Run Migrations

\`\`\`bash
python manage.py makemigrations
python manage.py migrate
\`\`\`

### 5. Create Superuser (Optional)

To access the Django admin panel:

\`\`\`bash
python manage.py createsuperuser
\`\`\`

Follow the prompts to create an admin account.

### 6. Initialize Default Grade Scale

Open Python shell:

\`\`\`bash
python manage.py shell
\`\`\`

Run this code:

\`\`\`python
from grades.models import GradeScale

default_scales = [
    {'letter': 'A+', 'min_percentage': 96, 'gpa_value': 4.3},
    {'letter': 'A', 'min_percentage': 93, 'gpa_value': 4.0},
    {'letter': 'A-', 'min_percentage': 90, 'gpa_value': 3.7},
    {'letter': 'B+', 'min_percentage': 87, 'gpa_value': 3.3},
    {'letter': 'B', 'min_percentage': 83, 'gpa_value': 3.0},
    {'letter': 'B-', 'min_percentage': 80, 'gpa_value': 2.7},
    {'letter': 'C+', 'min_percentage': 77, 'gpa_value': 2.3},
    {'letter': 'C', 'min_percentage': 73, 'gpa_value': 2.0},
    {'letter': 'C-', 'min_percentage': 70, 'gpa_value': 1.7},
    {'letter': 'D+', 'min_percentage': 67, 'gpa_value': 1.3},
    {'letter': 'D', 'min_percentage': 63, 'gpa_value': 1.0},
    {'letter': 'D-', 'min_percentage': 60, 'gpa_value': 0.7},
    {'letter': 'F', 'min_percentage': 0, 'gpa_value': 0.0},
]

for scale_data in default_scales:
    GradeScale.objects.create(**scale_data)

exit()
\`\`\`

### 7. Start Django Server

\`\`\`bash
python manage.py runserver
\`\`\`

The Django API will be available at `http://localhost:8000`

You can access:
- API endpoints: `http://localhost:8000/api/`
- Admin panel: `http://localhost:8000/admin/`

## Frontend Setup (React/Next.js)

### 1. Navigate to Project Root

Open a new terminal and navigate to the project root (not the backend folder).

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Configure Environment Variables

The `.env.local` file should already be created with:

\`\`\`
NEXT_PUBLIC_API_URL=http://localhost:8000/api
\`\`\`

If not, create it in the project root.

### 4. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

The React app will be available at `http://localhost:3000`

## Running Both Servers

You need to run both servers simultaneously:

1. **Terminal 1** (Django Backend):
   \`\`\`bash
   cd backend
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   python manage.py runserver
   \`\`\`

2. **Terminal 2** (React Frontend):
   \`\`\`bash
   npm run dev
   \`\`\`

## VS Code Setup

### Recommended Extensions

- Python
- Django
- Pylance
- ESLint
- Prettier

### Launch Configuration

Create `.vscode/launch.json`:

\`\`\`json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Django",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/backend/manage.py",
      "args": ["runserver"],
      "django": true,
      "justMyCode": true
    },
    {
      "name": "Next.js",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"]
    }
  ],
  "compounds": [
    {
      "name": "Full Stack",
      "configurations": ["Django", "Next.js"],
      "stopAll": true
    }
  ]
}
\`\`\`

This allows you to run both servers from VS Code's debug panel.

## API Endpoints

### Semesters
- `GET /api/semesters/` - List all semesters
- `POST /api/semesters/` - Create semester
- `GET /api/semesters/{id}/` - Get semester details
- `PATCH /api/semesters/{id}/` - Update semester
- `DELETE /api/semesters/{id}/` - Delete semester

### Courses
- `GET /api/courses/` - List all courses
- `GET /api/courses/?semester={id}` - Filter by semester
- `POST /api/courses/` - Create course
- `PATCH /api/courses/{id}/` - Update course
- `DELETE /api/courses/{id}/` - Delete course

### Assignments
- `GET /api/assignments/` - List all assignments
- `GET /api/assignments/?course={id}` - Filter by course
- `POST /api/assignments/` - Create assignment
- `PATCH /api/assignments/{id}/` - Update assignment
- `DELETE /api/assignments/{id}/` - Delete assignment

### Grade Scales
- `GET /api/grade-scales/` - List grade scales
- `POST /api/grade-scales/` - Create grade scale entry
- `POST /api/grade-scales/reset_default/` - Reset to default scale

## Troubleshooting

### CORS Errors

If you see CORS errors, ensure:
1. `django-cors-headers` is installed
2. `CORS_ALLOWED_ORIGINS` in `settings.py` includes your frontend URL
3. `corsheaders.middleware.CorsMiddleware` is first in `MIDDLEWARE`

### Database Issues

Reset the database:

\`\`\`bash
cd backend
rm db.sqlite3
python manage.py migrate
\`\`\`

Then reinitialize the grade scale (see step 6 above).

### Port Already in Use

If port 8000 or 3000 is already in use:

**Django:**
\`\`\`bash
python manage.py runserver 8001
\`\`\`

Update `.env.local` to use the new port.

**Next.js:**
\`\`\`bash
npm run dev -- -p 3001
\`\`\`

## Production Deployment

For production:

1. Set `DEBUG = False` in Django settings
2. Configure proper database (PostgreSQL recommended)
3. Set up static file serving
4. Use environment variables for secrets
5. Deploy Django and Next.js separately (e.g., Railway for Django, Vercel for Next.js)
