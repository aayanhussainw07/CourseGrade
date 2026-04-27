# Graph Report - .  (2026-04-26)

## Corpus Check
- 74 files · ~52,887 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 318 nodes · 405 edges · 59 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backend Data Models & Routes|Backend Data Models & Routes]]
- [[_COMMUNITY_Course Card Component|Course Card Component]]
- [[_COMMUNITY_Course Sidebar & GPA Summary|Course Sidebar & GPA Summary]]
- [[_COMMUNITY_Backend API Documentation|Backend API Documentation]]
- [[_COMMUNITY_Criterion Row UI|Criterion Row UI]]
- [[_COMMUNITY_Grade Utilities & Page Utils|Grade Utilities & Page Utils]]
- [[_COMMUNITY_Flask App Configuration|Flask App Configuration]]
- [[_COMMUNITY_Grade Scale Editor|Grade Scale Editor]]
- [[_COMMUNITY_UI Sheet Component|UI Sheet Component]]
- [[_COMMUNITY_Course Settings Persistence|Course Settings Persistence]]
- [[_COMMUNITY_Syllabus Import Dialog|Syllabus Import Dialog]]
- [[_COMMUNITY_App Settings|App Settings]]
- [[_COMMUNITY_CSV ImportExport|CSV Import/Export]]
- [[_COMMUNITY_API Client Layer|API Client Layer]]
- [[_COMMUNITY_Syllabus AI Route|Syllabus AI Route]]
- [[_COMMUNITY_Dashboard Panel Charts|Dashboard Panel Charts]]
- [[_COMMUNITY_UI Card Component|UI Card Component]]
- [[_COMMUNITY_React Hooks (Data & UndoRedo)|React Hooks (Data & Undo/Redo)]]
- [[_COMMUNITY_Storage Utilities|Storage Utilities]]
- [[_COMMUNITY_Type Definitions|Type Definitions]]
- [[_COMMUNITY_Next.js App Pages|Next.js App Pages]]
- [[_COMMUNITY_Backend Env Loader|Backend Env Loader]]
- [[_COMMUNITY_Marketing Page|Marketing Page]]
- [[_COMMUNITY_Grade Distribution Chart|Grade Distribution Chart]]
- [[_COMMUNITY_Rolling Number Animation|Rolling Number Animation]]
- [[_COMMUNITY_Sitemap|Sitemap]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_App Shell Layout|App Shell Layout]]
- [[_COMMUNITY_GPA Timeline Chart|GPA Timeline Chart]]
- [[_COMMUNITY_Delete Confirmation Dialog|Delete Confirmation Dialog]]
- [[_COMMUNITY_User Info Bar|User Info Bar]]
- [[_COMMUNITY_Auth Provider|Auth Provider]]
- [[_COMMUNITY_UI Switch Component|UI Switch Component]]
- [[_COMMUNITY_UI Badge Component|UI Badge Component]]
- [[_COMMUNITY_UI Input Component|UI Input Component]]
- [[_COMMUNITY_Course Context|Course Context]]
- [[_COMMUNITY_Course Color Picker|Course Color Picker]]
- [[_COMMUNITY_Intersection Observer Hook|Intersection Observer Hook]]
- [[_COMMUNITY_Share URL Hook|Share URL Hook]]
- [[_COMMUNITY_Utility Functions|Utility Functions]]
- [[_COMMUNITY_Placeholder Brand Assets|Placeholder Brand Assets]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_NextAuth Types|NextAuth Types]]
- [[_COMMUNITY_Next.js Env Types|Next.js Env Types]]
- [[_COMMUNITY_Marketing Data|Marketing Data]]
- [[_COMMUNITY_Auth Route|Auth Route]]
- [[_COMMUNITY_Share Page|Share Page]]
- [[_COMMUNITY_WSGI Entry Point|WSGI Entry Point]]
- [[_COMMUNITY_Semester Panel|Semester Panel]]
- [[_COMMUNITY_UI Label Component|UI Label Component]]
- [[_COMMUNITY_UI Dialog Component|UI Dialog Component]]
- [[_COMMUNITY_UI Button Component|UI Button Component]]
- [[_COMMUNITY_App Constants|App Constants]]
- [[_COMMUNITY_Auth Utilities|Auth Utilities]]
- [[_COMMUNITY_Flask Dependency|Flask Dependency]]
- [[_COMMUNITY_User Placeholder Image|User Placeholder Image]]
- [[_COMMUNITY_SVG Placeholder Image|SVG Placeholder Image]]

## God Nodes (most connected - your core abstractions)
1. `courses_collection()` - 10 edges
2. `_json_payload()` - 9 edges
3. `_request_user_id()` - 8 edges
4. `_parse_float()` - 8 edges
5. `course_detail()` - 8 edges
6. `assignments_collection()` - 8 edges
7. `updateCriterion()` - 8 edges
8. `_serialize_semester()` - 7 edges
9. `assignment_detail()` - 7 edges
10. `commitField()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `CourseGrade App Icon (3D Red Triangle Logo)` --conceptually_related_to--> `CourseGrade App`  [INFERRED]
  public/coursegrade.png → README.md
- `CourseGrade Alternative Logo` --conceptually_related_to--> `CourseGrade App`  [INFERRED]
  images/coursegrade.png → README.md
- `Grade Tracking Feature` --semantically_similar_to--> `Assignments API Endpoint`  [INFERRED] [semantically similar]
  README.md → backend/README.md
- `Grade Visualization (Graphs/Charts)` --semantically_similar_to--> `Grade Scales API Endpoint`  [INFERRED] [semantically similar]
  README.md → backend/README.md
- `CourseGrade App Icon (3D Red Triangle Logo)` --semantically_similar_to--> `CourseGrade Alternative Logo`  [INFERRED] [semantically similar]
  public/coursegrade.png → images/coursegrade.png

## Hyperedges (group relationships)
- **Flask Backend Technology Stack** — requirements_flask, requirements_flask_sqlalchemy, requirements_flask_migrate, requirements_flask_cors, requirements_gunicorn, requirements_psycopg2, requirements_python_dotenv [EXTRACTED 1.00]
- **CourseGrade Core Data Model** — backend_readme_semesters_endpoint, backend_readme_courses_endpoint, backend_readme_assignments_endpoint, backend_readme_grade_scales_endpoint [EXTRACTED 1.00]
- **CourseGrade Branding and Placeholder Assets** — public_coursegrade_logo, images_coursegrade_logo_alt, public_placeholder_logo_svg, public_placeholder_logo_png, public_placeholder_user, public_placeholder_svg [INFERRED 0.80]

## Communities

### Community 0 - "Backend Data Models & Routes"
Cohesion: 0.18
Nodes (30): Assignment, Course, GradeScale, Semester, TimestampMixin, assignment_detail(), _assignment_for_user(), assignments_collection() (+22 more)

### Community 1 - "Course Card Component"
Cohesion: 0.09
Nodes (18): addSubItem(), commitCourseName(), commitCredits(), commitPercentBoost(), convertToSubCriterion(), deleteSubItem(), duplicateSubItem(), formatCreditsDraft() (+10 more)

### Community 2 - "Course Sidebar & GPA Summary"
Cohesion: 0.11
Nodes (10): openDeleteDialog(), GpaSummary(), calculateCourseGrade(), calculateGPA(), getLetterGrade(), getMonochromeCardColor(), isCourseDefault(), letterGradeToGPA() (+2 more)

### Community 3 - "Backend API Documentation"
Cohesion: 0.11
Nodes (23): Assignments API Endpoint, AUTO_CREATE_TABLES Environment Option, Courses API Endpoint, Flask + Supabase Postgres Backend, Flask CORS Configuration, Flask Migrate (DB Migrations), Grade Scales API Endpoint, Gunicorn Production Server (+15 more)

### Community 4 - "Criterion Row UI"
Cohesion: 0.17
Nodes (15): updateSubItem(), clearDraft(), commitField(), commitSubItemName(), commitSubItemScore(), commitSubItemWeight(), getDraft(), getInputValue() (+7 more)

### Community 5 - "Grade Utilities & Page Utils"
Cohesion: 0.13
Nodes (7): getLetterGradeColor(), dashboardMessageStorageKey(), getGpaColor(), gpaToLetterGrade(), normalizeStorageScope(), readStoredDashboardMessage(), writeStoredDashboardMessage()

### Community 6 - "Flask App Configuration"
Cohesion: 0.16
Nodes (9): create_app(), Config, get_cors_origins(), get_database_url(), _normalize_database_url(), _postgres_driver_available(), Migrate, Fallback shim so app startup does not fail without flask-migrate. (+1 more)

### Community 7 - "Grade Scale Editor"
Cohesion: 0.29
Nodes (8): clampPercentage(), commitChanges(), getDisplayValue(), getEditingKey(), normalizeLetter(), normalizeMinimum(), sanitizePassFailSettings(), updateGrade()

### Community 8 - "UI Sheet Component"
Cohesion: 0.2
Nodes (0): 

### Community 9 - "Course Settings Persistence"
Cohesion: 0.44
Nodes (8): applyStoredSettingsToSemesters(), cloneOptionalGradeScale(), cloneSubItems(), persistCourseSettings(), readStoredCourseSettings(), removeCourseSettings(), writeStoredCourseSettings(), cloneGradeScale()

### Community 10 - "Syllabus Import Dialog"
Cohesion: 0.32
Nodes (3): handleDrop(), handleFileInput(), selectFile()

### Community 11 - "App Settings"
Cohesion: 0.32
Nodes (4): loadAppSettings(), saveAppSettings(), commitCredits(), update()

### Community 12 - "CSV Import/Export"
Cohesion: 0.43
Nodes (7): createPortableEnvelope(), parseCourseCsv(), parsePortableEnvelope(), parseSemesterCsv(), sanitizeCriteria(), serializeCourseCsv(), serializeSemesterCsv()

### Community 13 - "API Client Layer"
Cohesion: 0.29
Nodes (3): apiFetch(), ApiUnavailableError, formatErrorPayload()

### Community 14 - "Syllabus AI Route"
Cohesion: 0.83
Nodes (3): getWindowKey(), POST(), validateGeminiResponse()

### Community 15 - "Dashboard Panel Charts"
Cohesion: 0.67
Nodes (2): arc(), slicePath()

### Community 16 - "UI Card Component"
Cohesion: 0.5
Nodes (0): 

### Community 17 - "React Hooks (Data & Undo/Redo)"
Cohesion: 0.5
Nodes (2): useSemesterData(), useUndoRedo()

### Community 18 - "Storage Utilities"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Type Definitions"
Cohesion: 0.67
Nodes (2): apiToFrontendCourse(), normalizePercentage()

### Community 20 - "Next.js App Pages"
Cohesion: 0.67
Nodes (1): Page()

### Community 21 - "Backend Env Loader"
Cohesion: 0.67
Nodes (2): load_backend_env(), Lightweight dotenv loader for direct `python app.py` runs.     Does not override

### Community 22 - "Marketing Page"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Grade Distribution Chart"
Cohesion: 1.0
Nodes (2): arc(), slicePath()

### Community 24 - "Rolling Number Animation"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Sitemap"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Home Page"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "App Shell Layout"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "GPA Timeline Chart"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Delete Confirmation Dialog"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "User Info Bar"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Auth Provider"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "UI Switch Component"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "UI Badge Component"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "UI Input Component"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Course Context"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Course Color Picker"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Intersection Observer Hook"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Share URL Hook"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Utility Functions"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Placeholder Brand Assets"
Cohesion: 1.0
Nodes (2): Placeholder Logo PNG, Placeholder Logo SVG

### Community 42 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "NextAuth Types"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Next.js Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Marketing Data"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Auth Route"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Share Page"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "WSGI Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Semester Panel"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "UI Label Component"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "UI Dialog Component"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "UI Button Component"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "App Constants"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Auth Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Flask Dependency"
Cohesion: 1.0
Nodes (1): Flask >=3.0.0,<4.0.0

### Community 57 - "User Placeholder Image"
Cohesion: 1.0
Nodes (1): Placeholder User Avatar

### Community 58 - "SVG Placeholder Image"
Cohesion: 1.0
Nodes (1): Placeholder Image SVG

## Knowledge Gaps
- **14 isolated node(s):** `Config`, `Fallback shim so app startup does not fail without flask-migrate.`, `Lightweight dotenv loader for direct `python app.py` runs.     Does not override`, `Flask >=3.0.0,<4.0.0`, `Flask-SQLAlchemy >=3.1.1` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Sitemap`** (2 nodes): `sitemap.ts`, `sitemap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Page`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Shell Layout`** (2 nodes): `layout.tsx`, `onResize()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `GPA Timeline Chart`** (2 nodes): `gpa-timeline-chart.tsx`, `catmullRom()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Delete Confirmation Dialog`** (2 nodes): `delete-confirmation-dialog.tsx`, `DeleteConfirmationDialog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User Info Bar`** (2 nodes): `user-info-bar.tsx`, `UserInfoBar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Provider`** (2 nodes): `AuthProvider()`, `auth-provider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Switch Component`** (2 nodes): `switch.tsx`, `Switch()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Badge Component`** (2 nodes): `Badge()`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Input Component`** (2 nodes): `input.tsx`, `Input()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Course Context`** (2 nodes): `CourseContext.tsx`, `useCourseContext()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Course Color Picker`** (2 nodes): `CourseColorPicker.tsx`, `handleClick()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Intersection Observer Hook`** (2 nodes): `use-in-view.ts`, `useInView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Share URL Hook`** (2 nodes): `useShareUrl.ts`, `useShareUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utility Functions`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Placeholder Brand Assets`** (2 nodes): `Placeholder Logo PNG`, `Placeholder Logo SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NextAuth Types`** (1 nodes): `next-auth.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Env Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Marketing Data`** (1 nodes): `page-marketing-data.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Route`** (1 nodes): `route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Share Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `WSGI Entry Point`** (1 nodes): `wsgi.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Semester Panel`** (1 nodes): `semester-panel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Label Component`** (1 nodes): `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Dialog Component`** (1 nodes): `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Button Component`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Constants`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Utilities`** (1 nodes): `auth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Flask Dependency`** (1 nodes): `Flask >=3.0.0,<4.0.0`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User Placeholder Image`** (1 nodes): `Placeholder User Avatar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SVG Placeholder Image`** (1 nodes): `Placeholder Image SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getLetterGradeColor()` connect `Grade Utilities & Page Utils` to `Course Sidebar & GPA Summary`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `GradeScale` connect `Backend Data Models & Routes` to `Flask App Configuration`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `courses_collection()` (e.g. with `Course` and `Assignment`) actually correct?**
  _`courses_collection()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Config`, `Fallback shim so app startup does not fail without flask-migrate.`, `Lightweight dotenv loader for direct `python app.py` runs.     Does not override` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Course Card Component` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Course Sidebar & GPA Summary` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Backend API Documentation` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._