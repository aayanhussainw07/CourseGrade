# Graph Report - /Users/aayanhussain/Documents/projects/CourseGrade  (2026-04-26)

## Corpus Check
- 64 files · ~75,765 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 318 nodes · 405 edges · 59 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]

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
- `CourseGrade App` --conceptually_related_to--> `CourseGrade App Icon (3D Red Triangle Logo)`  [INFERRED]
  README.md → public/coursegrade.png
- `CourseGrade App` --conceptually_related_to--> `CourseGrade Alternative Logo`  [INFERRED]
  README.md → images/coursegrade.png
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

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (30): Assignment, Course, GradeScale, Semester, TimestampMixin, assignment_detail(), _assignment_for_user(), assignments_collection() (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (18): addSubItem(), commitCourseName(), commitCredits(), commitPercentBoost(), convertToSubCriterion(), deleteSubItem(), duplicateSubItem(), formatCreditsDraft() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (10): openDeleteDialog(), GpaSummary(), calculateCourseGrade(), calculateGPA(), getLetterGrade(), getMonochromeCardColor(), isCourseDefault(), letterGradeToGPA() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (23): Assignments API Endpoint, AUTO_CREATE_TABLES Environment Option, Courses API Endpoint, Flask + Supabase Postgres Backend, Flask CORS Configuration, Flask Migrate (DB Migrations), Grade Scales API Endpoint, Gunicorn Production Server (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (15): updateSubItem(), clearDraft(), commitField(), commitSubItemName(), commitSubItemScore(), commitSubItemWeight(), getDraft(), getInputValue() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (7): getLetterGradeColor(), dashboardMessageStorageKey(), getGpaColor(), gpaToLetterGrade(), normalizeStorageScope(), readStoredDashboardMessage(), writeStoredDashboardMessage()

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (9): create_app(), Config, get_cors_origins(), get_database_url(), _normalize_database_url(), _postgres_driver_available(), Migrate, Fallback shim so app startup does not fail without flask-migrate. (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (8): clampPercentage(), commitChanges(), getDisplayValue(), getEditingKey(), normalizeLetter(), normalizeMinimum(), sanitizePassFailSettings(), updateGrade()

### Community 8 - "Community 8"
Cohesion: 0.2
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 0.44
Nodes (8): applyStoredSettingsToSemesters(), cloneOptionalGradeScale(), cloneSubItems(), persistCourseSettings(), readStoredCourseSettings(), removeCourseSettings(), writeStoredCourseSettings(), cloneGradeScale()

### Community 10 - "Community 10"
Cohesion: 0.32
Nodes (3): handleDrop(), handleFileInput(), selectFile()

### Community 11 - "Community 11"
Cohesion: 0.32
Nodes (4): loadAppSettings(), saveAppSettings(), commitCredits(), update()

### Community 12 - "Community 12"
Cohesion: 0.43
Nodes (7): createPortableEnvelope(), parseCourseCsv(), parsePortableEnvelope(), parseSemesterCsv(), sanitizeCriteria(), serializeCourseCsv(), serializeSemesterCsv()

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (3): apiFetch(), ApiUnavailableError, formatErrorPayload()

### Community 14 - "Community 14"
Cohesion: 0.83
Nodes (3): getWindowKey(), POST(), validateGeminiResponse()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (2): arc(), slicePath()

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (2): useSemesterData(), useUndoRedo()

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (2): apiToFrontendCourse(), normalizePercentage()

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (1): Page()

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (2): load_backend_env(), Lightweight dotenv loader for direct `python app.py` runs.     Does not override

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (2): arc(), slicePath()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (2): Placeholder Logo PNG, Placeholder Logo SVG

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (1): Flask >=3.0.0,<4.0.0

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (1): Placeholder User Avatar

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (1): Placeholder Image SVG

## Knowledge Gaps
- **14 isolated node(s):** `Config`, `Fallback shim so app startup does not fail without flask-migrate.`, `Lightweight dotenv loader for direct `python app.py` runs.     Does not override`, `Flask >=3.0.0,<4.0.0`, `Flask-SQLAlchemy >=3.1.1` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 25`** (2 nodes): `sitemap.ts`, `sitemap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `layout.tsx`, `onResize()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `gpa-timeline-chart.tsx`, `catmullRom()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `delete-confirmation-dialog.tsx`, `DeleteConfirmationDialog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `user-info-bar.tsx`, `UserInfoBar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `AuthProvider()`, `auth-provider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `switch.tsx`, `Switch()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `Badge()`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `input.tsx`, `Input()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `CourseContext.tsx`, `useCourseContext()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `CourseColorPicker.tsx`, `handleClick()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `use-in-view.ts`, `useInView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `useShareUrl.ts`, `useShareUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `Placeholder Logo PNG`, `Placeholder Logo SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `next.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `next-auth.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `page-marketing-data.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `wsgi.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `semester-panel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `auth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `Flask >=3.0.0,<4.0.0`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `Placeholder User Avatar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `Placeholder Image SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getLetterGradeColor()` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `GradeScale` connect `Community 0` to `Community 6`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `courses_collection()` (e.g. with `Course` and `Assignment`) actually correct?**
  _`courses_collection()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Config`, `Fallback shim so app startup does not fail without flask-migrate.`, `Lightweight dotenv loader for direct `python app.py` runs.     Does not override` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._