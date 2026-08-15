from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from threading import Lock

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from extensions import db
import json

from models import (
    AiCall,
    Assignment,
    Course,
    Feedback,
    GradeScale,
    LegacyLocalBackup,
    Semester,
    UserActivity,
    UserSettings,
)
from security_limits import MAX_ASSIGNMENTS_PER_COURSE

MAX_SUB_ITEMS_PER_ASSIGNMENT = 200
LOCAL_MIGRATION_VERSION = 1

api = Blueprint("api", __name__, url_prefix="/api")

DEFAULT_GRADE_SCALES = [
    {"letter": "A+", "min_percentage": 96, "gpa_value": 4.33},
    {"letter": "A", "min_percentage": 93, "gpa_value": 4.0},
    {"letter": "A-", "min_percentage": 90, "gpa_value": 3.7},
    {"letter": "B+", "min_percentage": 87, "gpa_value": 3.3},
    {"letter": "B", "min_percentage": 83, "gpa_value": 3.0},
    {"letter": "B-", "min_percentage": 80, "gpa_value": 2.7},
    {"letter": "C+", "min_percentage": 77, "gpa_value": 2.3},
    {"letter": "C", "min_percentage": 73, "gpa_value": 2.0},
    {"letter": "C-", "min_percentage": 70, "gpa_value": 1.7},
    {"letter": "D+", "min_percentage": 67, "gpa_value": 1.3},
    {"letter": "D", "min_percentage": 63, "gpa_value": 1.0},
    {"letter": "D-", "min_percentage": 60, "gpa_value": 0.7},
    {"letter": "F", "min_percentage": 0, "gpa_value": 0.0},
]

# Sole admin. Mirrors the client-safe canonical value in lib/is-admin.ts;
# keep this backend copy aligned because the services run independently.
ADMIN_EMAIL = "aayanhussainw07@gmail.com"

_activity_cache_lock = Lock()
_activity_cache_date: date | None = None
_activity_cache_user_ids: set[str] = set()


def _admin_emails() -> set[str]:
    return {ADMIN_EMAIL}


def _request_user_id() -> str:
    user_id = request.headers.get("X-User-Id", "").strip()
    return user_id or "default"


def _admin_forbidden():
    admin_email = request.headers.get("X-User-Email", "").strip().lower()
    if admin_email not in _admin_emails():
        return jsonify({"detail": "Forbidden."}), 403
    return None


def record_user_activity(user_id: str) -> None:
    """Mark a user active once per UTC day and worker. Best-effort."""
    global _activity_cache_date
    if not user_id or user_id == "default":
        return
    today = datetime.now(timezone.utc).date()
    with _activity_cache_lock:
        if _activity_cache_date != today:
            _activity_cache_user_ids.clear()
            _activity_cache_date = today
        if user_id in _activity_cache_user_ids:
            return
        # Reserve before I/O so concurrent requests for one user do not race.
        _activity_cache_user_ids.add(user_id)

    try:
        dialect = db.engine.dialect.name
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            stmt = (
                pg_insert(UserActivity)
                .values(user_id=user_id, activity_date=today)
                .on_conflict_do_nothing(index_elements=["user_id", "activity_date"])
            )
            db.session.execute(stmt)
        elif dialect == "sqlite":
            from sqlalchemy.dialects.sqlite import insert as sqlite_insert

            stmt = (
                sqlite_insert(UserActivity)
                .values(user_id=user_id, activity_date=today)
                .on_conflict_do_nothing()
            )
            db.session.execute(stmt)
        else:
            db.session.add(UserActivity(user_id=user_id, activity_date=today))
        db.session.commit()
    except Exception:
        db.session.rollback()
        with _activity_cache_lock:
            if _activity_cache_date == today:
                _activity_cache_user_ids.discard(user_id)


def _json_payload() -> dict:
    payload = request.get_json(silent=True)
    if payload is None:
        return {}
    if not isinstance(payload, dict):
        return {}
    return payload


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _serialize_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _serialize_assignment(assignment: Assignment) -> dict:
    return {
        "id": assignment.id,
        "course": assignment.course_id,
        "name": assignment.name,
        "weight": assignment.weight,
        "earned": assignment.earned,
        "total": assignment.total,
        "drop_lowest": assignment.drop_lowest,
        "client_id": assignment.client_id,
        "sort_order": assignment.sort_order,
        "extra_credit": assignment.extra_credit if assignment.extra_credit is not None else 0,
        "sub_items": assignment.sub_items if isinstance(assignment.sub_items, list) else [],
        "created_at": _serialize_datetime(assignment.created_at),
        "updated_at": _serialize_datetime(assignment.updated_at),
    }


def _serialize_course(course: Course) -> dict:
    assignments = sorted(course.assignments, key=lambda assignment: (assignment.sort_order, assignment.id))
    return {
        "id": course.id,
        "semester": course.semester_id,
        "name": course.name,
        "credits": course.credits,
        "is_pass_fail": course.is_pass_fail,
        "percent_boost": course.percent_boost,
        "header_color": course.header_color,
        "sort_order": course.sort_order,
        "pass_label": course.pass_label if course.pass_label is not None else "P",
        "fail_label": course.fail_label if course.fail_label is not None else "F",
        "pass_threshold": course.pass_threshold if course.pass_threshold is not None else 60,
        "letter_grade_scale": course.letter_grade_scale,
        "assignments": [_serialize_assignment(assignment) for assignment in assignments],
        "created_at": _serialize_datetime(course.created_at),
        "updated_at": _serialize_datetime(course.updated_at),
    }


def _serialize_semester(semester: Semester) -> dict:
    courses = sorted(semester.courses, key=lambda course: (course.sort_order, course.id))
    return {
        "id": semester.id,
        "name": semester.name,
        "user_id": semester.user_id,
        "background": semester.background,
        "timeline_date": _serialize_date(semester.timeline_date),
        "ignored": semester.ignored,
        "sort_order": semester.sort_order,
        "courses": [_serialize_course(course) for course in courses],
        "created_at": _serialize_datetime(semester.created_at),
        "updated_at": _serialize_datetime(semester.updated_at),
    }


def _serialize_grade_scale(grade_scale: GradeScale) -> dict:
    return {
        "id": grade_scale.id,
        "letter": grade_scale.letter,
        "min_percentage": grade_scale.min_percentage,
        "gpa_value": grade_scale.gpa_value,
        "created_at": _serialize_datetime(grade_scale.created_at),
    }


def _parse_int(value: object, field: str, errors: dict[str, list[str]], min_value: int | None = None) -> int | None:
    if isinstance(value, bool):
        errors.setdefault(field, []).append("A valid integer is required.")
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        errors.setdefault(field, []).append("A valid integer is required.")
        return None

    if min_value is not None and parsed < min_value:
        errors.setdefault(field, []).append(f"Ensure this value is greater than or equal to {min_value}.")
        return None

    return parsed


def _parse_float(
    value: object,
    field: str,
    errors: dict[str, list[str]],
    min_value: float | None = None,
    max_value: float | None = None,
) -> float | None:
    if isinstance(value, bool):
        errors.setdefault(field, []).append("A valid number is required.")
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        errors.setdefault(field, []).append("A valid number is required.")
        return None

    if min_value is not None and parsed < min_value:
        errors.setdefault(field, []).append(f"Ensure this value is greater than or equal to {min_value}.")
        return None
    if max_value is not None and parsed > max_value:
        errors.setdefault(field, []).append(f"Ensure this value is less than or equal to {max_value}.")
        return None

    return parsed


def _parse_bool(value: object, field: str, errors: dict[str, list[str]]) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False

    errors.setdefault(field, []).append("Must be a valid boolean.")
    return None


def _parse_optional_short_string(value: object, field: str, errors: dict[str, list[str]], max_length: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        errors.setdefault(field, []).append("Not a valid string.")
        return None
    normalized = value.strip()
    if normalized == "":
        return None
    if len(normalized) > max_length:
        errors.setdefault(field, []).append(f"Ensure this field has no more than {max_length} characters.")
        return None
    return normalized


def _parse_date(value: object, field: str, errors: dict[str, list[str]]) -> date | None:
    if value is None:
        return None
    if not isinstance(value, str):
        errors.setdefault(field, []).append("Date has wrong format. Use one of these formats instead: YYYY-MM-DD.")
        return None

    try:
        return date.fromisoformat(value)
    except ValueError:
        errors.setdefault(field, []).append("Date has wrong format. Use one of these formats instead: YYYY-MM-DD.")
        return None


def _parse_grade_scale(value: object, field: str, errors: dict[str, list[str]]) -> list[dict] | None:
    if not isinstance(value, list) or len(value) == 0 or len(value) > 30:
        errors.setdefault(field, []).append("Expected a non-empty list with no more than 30 grades.")
        return None

    parsed: list[dict] = []
    seen_letters: set[str] = set()
    for index, item in enumerate(value):
        item_field = f"{field}[{index}]"
        if not isinstance(item, dict):
            errors.setdefault(item_field, []).append("Each grade must be an object.")
            continue
        letter = item.get("letter")
        if not isinstance(letter, str) or not letter.strip() or len(letter.strip()) > 8:
            errors.setdefault(f"{item_field}.letter", []).append("Must be a non-empty string of at most 8 characters.")
            continue
        normalized_letter = letter.strip()
        if normalized_letter in seen_letters:
            errors.setdefault(f"{item_field}.letter", []).append("Grade labels must be unique.")
            continue
        minimum = _parse_float(item.get("min"), f"{item_field}.min", errors, min_value=0, max_value=100)
        if minimum is None:
            continue
        seen_letters.add(normalized_letter)
        parsed.append({"letter": normalized_letter, "min": minimum})

    return parsed if not any(key.startswith(field) for key in errors) else None


def _parse_sub_items(value: object, field: str, errors: dict[str, list[str]]) -> list[dict] | None:
    if not isinstance(value, list):
        errors.setdefault(field, []).append("Expected a list.")
        return None
    if len(value) > MAX_SUB_ITEMS_PER_ASSIGNMENT:
        errors.setdefault(field, []).append(
            f"Ensure this list has no more than {MAX_SUB_ITEMS_PER_ASSIGNMENT} items."
        )
        return None

    parsed: list[dict] = []
    seen_ids: set[str] = set()
    for index, item in enumerate(value):
        item_field = f"{field}[{index}]"
        if not isinstance(item, dict):
            errors.setdefault(item_field, []).append("Each sub-item must be an object.")
            continue
        item_id = item.get("id")
        name = item.get("name", "Item")
        if not isinstance(item_id, str) or not item_id.strip() or len(item_id) > 64:
            errors.setdefault(f"{item_field}.id", []).append("Must be a non-empty string of at most 64 characters.")
        elif item_id in seen_ids:
            errors.setdefault(f"{item_field}.id", []).append("Sub-item IDs must be unique.")
        else:
            seen_ids.add(item_id)
        if not isinstance(name, str) or len(name) > 200:
            errors.setdefault(f"{item_field}.name", []).append("Must be a string of at most 200 characters.")
        score = _parse_float(item.get("score", 0), f"{item_field}.score", errors, min_value=0)
        parsed_item = {"id": item_id, "name": name, "score": score}
        if "weight" in item:
            parsed_item["weight"] = _parse_float(
                item.get("weight"), f"{item_field}.weight", errors, min_value=0, max_value=100
            )
        parsed.append(parsed_item)

    return parsed if not any(key.startswith(field) for key in errors) else None


def _parse_assignment_seed(
    value: object,
    index: int,
    errors: dict[str, list[str]],
) -> dict[str, object] | None:
    base_field = f"assignments[{index}]"
    if not isinstance(value, dict):
        errors.setdefault(base_field, []).append("Each assignment must be an object.")
        return None

    name_field = f"{base_field}.name"
    weight_field = f"{base_field}.weight"
    earned_field = f"{base_field}.earned"
    total_field = f"{base_field}.total"
    drop_lowest_field = f"{base_field}.drop_lowest"
    client_id_field = f"{base_field}.client_id"
    extra_credit_field = f"{base_field}.extra_credit"
    sub_items_field = f"{base_field}.sub_items"

    name = value.get("name", "Assignment")
    if not isinstance(name, str):
        errors.setdefault(name_field, []).append("Not a valid string.")
    elif len(name) > 200:
        errors.setdefault(name_field, []).append("Ensure this field has no more than 200 characters.")

    weight = _parse_float(value.get("weight"), weight_field, errors, min_value=0, max_value=100)
    earned = _parse_float(value.get("earned", 0), earned_field, errors, min_value=0)
    total = _parse_float(value.get("total", 100), total_field, errors, min_value=0.01)
    drop_lowest = _parse_int(value.get("drop_lowest", 0), drop_lowest_field, errors, min_value=0)
    client_id = value.get("client_id")
    if client_id is not None and (
        not isinstance(client_id, str) or not client_id.strip() or len(client_id) > 64
    ):
        errors.setdefault(client_id_field, []).append("Must be a non-empty string of at most 64 characters.")
    extra_credit = _parse_float(value.get("extra_credit", 0), extra_credit_field, errors, min_value=0, max_value=100)
    sub_items = _parse_sub_items(value.get("sub_items", []), sub_items_field, errors)

    if any(key.startswith(base_field) for key in errors):
        return None

    return {
        "name": name,
        "weight": weight,
        "earned": earned,
        "total": total,
        "drop_lowest": drop_lowest,
        "client_id": client_id.strip() if isinstance(client_id, str) else None,
        "sort_order": index,
        "extra_credit": extra_credit,
        "sub_items": sub_items,
    }


def _course_for_user(course_id: int, user_id: str) -> Course | None:
    return (
        Course.query.join(Semester, Course.semester_id == Semester.id)
        .filter(Course.id == course_id, Semester.user_id == user_id)
        .first()
    )


def _assignment_for_user(assignment_id: int, user_id: str) -> Assignment | None:
    return (
        Assignment.query.join(Course, Assignment.course_id == Course.id)
        .join(Semester, Course.semester_id == Semester.id)
        .filter(Assignment.id == assignment_id, Semester.user_id == user_id)
        .first()
    )


def _settings_for_user(user_id: str, create: bool = False) -> UserSettings | None:
    row = UserSettings.query.filter_by(user_id=user_id).first()
    if row is None and create:
        row = UserSettings(user_id=user_id, settings_json="{}")
        db.session.add(row)
    return row


def _apply_exact_order(rows: list, ordered_ids: object, field: str, errors: dict[str, list[str]]) -> None:
    if not isinstance(ordered_ids, list):
        errors.setdefault(field, []).append("Expected a list of IDs.")
        return
    parsed_ids: list[int] = []
    for value in ordered_ids:
        parsed = _parse_int(value, field, errors, min_value=1)
        if parsed is not None:
            parsed_ids.append(parsed)
    current_ids = {row.id for row in rows}
    if len(parsed_ids) != len(set(parsed_ids)):
        errors.setdefault(field, []).append("IDs must be unique.")
    if set(parsed_ids) != current_ids or len(parsed_ids) != len(rows):
        errors.setdefault(field, []).append("Order must contain every owned item exactly once.")
        return
    for position, row_id in enumerate(parsed_ids):
        next(row for row in rows if row.id == row_id).sort_order = position


@api.route("/health/", methods=["GET"])
def healthcheck():
    return jsonify({"status": "ok"})


@api.route("/semesters/", methods=["GET", "POST"])
def semesters_collection():
    user_id = _request_user_id()

    if request.method == "GET":
        semesters = Semester.query.filter_by(user_id=user_id).order_by(Semester.sort_order, Semester.id).all()
        return jsonify([_serialize_semester(semester) for semester in semesters])

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    name = payload.get("name", "New Semester")
    if not isinstance(name, str):
        errors.setdefault("name", []).append("Not a valid string.")
    elif len(name) > 200:
        errors.setdefault("name", []).append("Ensure this field has no more than 200 characters.")

    background = payload.get("background", "sunrise")
    if not isinstance(background, str):
        errors.setdefault("background", []).append("Not a valid string.")
    elif len(background) > 50:
        errors.setdefault("background", []).append("Ensure this field has no more than 50 characters.")

    timeline_date = _parse_date(payload.get("timeline_date"), "timeline_date", errors)

    ignored = payload.get("ignored", False)
    if not isinstance(ignored, bool):
        errors.setdefault("ignored", []).append("Not a valid boolean.")

    if errors:
        return jsonify(errors), 400

    next_sort_order = db.session.query(func.coalesce(func.max(Semester.sort_order), -1)).filter(
        Semester.user_id == user_id
    ).scalar() + 1
    semester = Semester(
        name=name,
        user_id=user_id,
        background=background,
        timeline_date=timeline_date,
        ignored=ignored,
        sort_order=next_sort_order,
    )
    db.session.add(semester)
    db.session.commit()

    return jsonify(_serialize_semester(semester)), 201


@api.route("/semesters/<int:semester_id>/", methods=["GET", "PATCH", "DELETE"])
def semester_detail(semester_id: int):
    user_id = _request_user_id()
    semester = Semester.query.filter_by(id=semester_id, user_id=user_id).first()
    if semester is None:
        return jsonify({"detail": "Not found."}), 404

    if request.method == "GET":
        return jsonify(_serialize_semester(semester))

    if request.method == "DELETE":
        settings_row = _settings_for_user(user_id)
        if settings_row is not None and settings_row.last_active_semester_id == semester.id:
            settings_row.last_active_semester_id = None
        db.session.delete(semester)
        db.session.commit()
        return "", 204

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    if "name" in payload:
        name = payload.get("name")
        if not isinstance(name, str):
            errors.setdefault("name", []).append("Not a valid string.")
        elif len(name) > 200:
            errors.setdefault("name", []).append("Ensure this field has no more than 200 characters.")
        else:
            semester.name = name

    if "background" in payload:
        background = payload.get("background")
        if not isinstance(background, str):
            errors.setdefault("background", []).append("Not a valid string.")
        elif len(background) > 50:
            errors.setdefault("background", []).append("Ensure this field has no more than 50 characters.")
        else:
            semester.background = background

    if "timeline_date" in payload:
        timeline_date = _parse_date(payload.get("timeline_date"), "timeline_date", errors)
        if "timeline_date" not in errors:
            semester.timeline_date = timeline_date

    if "ignored" in payload:
        ignored = payload.get("ignored")
        if not isinstance(ignored, bool):
            errors.setdefault("ignored", []).append("Not a valid boolean.")
        else:
            semester.ignored = ignored

    if errors:
        return jsonify(errors), 400

    db.session.commit()
    return jsonify(_serialize_semester(semester))


@api.route("/semesters/order/", methods=["PUT"])
def semester_order():
    user_id = _request_user_id()
    rows = Semester.query.filter_by(user_id=user_id).all()
    errors: dict[str, list[str]] = {}
    _apply_exact_order(rows, _json_payload().get("ids"), "ids", errors)
    if errors:
        return jsonify(errors), 400
    db.session.commit()
    return jsonify({"ids": [row.id for row in sorted(rows, key=lambda row: row.sort_order)]})


@api.route("/semesters/<int:semester_id>/courses/order/", methods=["PUT"])
def course_order(semester_id: int):
    user_id = _request_user_id()
    semester = Semester.query.filter_by(id=semester_id, user_id=user_id).first()
    if semester is None:
        return jsonify({"detail": "Not found."}), 404
    rows = Course.query.filter_by(semester_id=semester.id).all()
    errors: dict[str, list[str]] = {}
    _apply_exact_order(rows, _json_payload().get("ids"), "ids", errors)
    if errors:
        return jsonify(errors), 400
    db.session.commit()
    return jsonify({"ids": [row.id for row in sorted(rows, key=lambda row: row.sort_order)]})


@api.route("/semesters/<int:semester_id>/duplicate/", methods=["POST"])
def semester_duplicate(semester_id: int):
    user_id = _request_user_id()
    semester = Semester.query.filter_by(id=semester_id, user_id=user_id).first()
    if semester is None:
        return jsonify({"detail": "Not found."}), 404

    duplicate = Semester(
        name=f"{semester.name} (Copy)",
        user_id=semester.user_id,
        background=semester.background,
        timeline_date=semester.timeline_date,
        ignored=semester.ignored,
        sort_order=db.session.query(func.coalesce(func.max(Semester.sort_order), -1)).filter(
            Semester.user_id == user_id
        ).scalar() + 1,
    )
    db.session.add(duplicate)
    db.session.flush()

    courses = Course.query.filter_by(semester_id=semester.id).order_by(Course.sort_order, Course.id).all()
    for course in courses:
        copied_course = Course(
            semester_id=duplicate.id,
            name=course.name,
            credits=course.credits,
            is_pass_fail=course.is_pass_fail,
            percent_boost=course.percent_boost,
            header_color=course.header_color,
            sort_order=course.sort_order,
            pass_label=course.pass_label,
            fail_label=course.fail_label,
            pass_threshold=course.pass_threshold,
            letter_grade_scale=course.letter_grade_scale,
        )
        db.session.add(copied_course)
        db.session.flush()

        assignments = Assignment.query.filter_by(course_id=course.id).order_by(Assignment.sort_order, Assignment.id).all()
        for assignment in assignments:
            db.session.add(
                Assignment(
                    course_id=copied_course.id,
                    name=assignment.name,
                    weight=assignment.weight,
                    earned=assignment.earned,
                    total=assignment.total,
                    drop_lowest=assignment.drop_lowest,
                    client_id=assignment.client_id,
                    sort_order=assignment.sort_order,
                    extra_credit=assignment.extra_credit,
                    sub_items=assignment.sub_items,
                )
            )

    db.session.commit()
    return jsonify(_serialize_semester(duplicate)), 201


@api.route("/courses/", methods=["GET", "POST"])
def courses_collection():
    user_id = _request_user_id()

    if request.method == "GET":
        courses_query = Course.query.join(Semester, Course.semester_id == Semester.id).filter(Semester.user_id == user_id)

        semester_filter = request.args.get("semester")
        if semester_filter is not None:
            errors: dict[str, list[str]] = {}
            semester_id = _parse_int(semester_filter, "semester", errors, min_value=1)
            if errors:
                return jsonify(errors), 400
            courses_query = courses_query.filter(Course.semester_id == semester_id)

        courses = courses_query.order_by(Course.sort_order, Course.id).all()
        return jsonify([_serialize_course(course) for course in courses])

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    semester_id = _parse_int(payload.get("semester"), "semester", errors, min_value=1)

    name = payload.get("name", "New Course")
    if not isinstance(name, str):
        errors.setdefault("name", []).append("Not a valid string.")
    elif len(name) > 200:
        errors.setdefault("name", []).append("Ensure this field has no more than 200 characters.")

    credits = _parse_float(payload.get("credits", 3), "credits", errors, min_value=0)

    is_pass_fail = _parse_bool(payload.get("is_pass_fail", False), "is_pass_fail", errors)

    percent_boost = _parse_float(payload.get("percent_boost", 0), "percent_boost", errors, min_value=0, max_value=100)

    header_color = _parse_optional_short_string(payload.get("header_color"), "header_color", errors, 32)
    pass_label = _parse_optional_short_string(payload.get("pass_label", "P"), "pass_label", errors, 24)
    fail_label = _parse_optional_short_string(payload.get("fail_label", "F"), "fail_label", errors, 24)
    pass_threshold = _parse_float(
        payload.get("pass_threshold", 60), "pass_threshold", errors, min_value=0, max_value=100
    )
    default_letter_scale = [
        {"letter": grade["letter"], "min": grade["min_percentage"]} for grade in DEFAULT_GRADE_SCALES
    ]
    letter_grade_scale = _parse_grade_scale(
        payload.get("letter_grade_scale", default_letter_scale), "letter_grade_scale", errors
    )

    assignment_seeds_payload = payload.get("assignments")
    assignment_seeds: list[dict[str, object]] = []
    if assignment_seeds_payload is not None:
        if not isinstance(assignment_seeds_payload, list):
            errors.setdefault("assignments", []).append("Expected a list of assignment objects.")
        elif len(assignment_seeds_payload) > MAX_ASSIGNMENTS_PER_COURSE:
            errors.setdefault("assignments", []).append(
                f"Ensure this list has no more than {MAX_ASSIGNMENTS_PER_COURSE} items."
            )
        else:
            for index, assignment_seed in enumerate(assignment_seeds_payload):
                parsed = _parse_assignment_seed(assignment_seed, index, errors)
                if parsed is not None:
                    assignment_seeds.append(parsed)

    if errors:
        return jsonify(errors), 400

    semester = Semester.query.filter_by(id=semester_id).first()
    if semester is None:
        return jsonify({"semester": ["Invalid pk."]}), 400

    if semester.user_id != user_id:
        return jsonify({"detail": "Cannot create courses for another user's semester."}), 403

    next_sort_order = db.session.query(func.coalesce(func.max(Course.sort_order), -1)).filter(
        Course.semester_id == semester_id
    ).scalar() + 1
    course = Course(
        semester_id=semester_id,
        name=name,
        credits=credits,
        is_pass_fail=is_pass_fail,
        percent_boost=percent_boost,
        header_color=header_color,
        sort_order=next_sort_order,
        pass_label=pass_label or "P",
        fail_label=fail_label or "F",
        pass_threshold=pass_threshold,
        letter_grade_scale=letter_grade_scale,
    )
    db.session.add(course)

    for assignment_seed in assignment_seeds:
        assignment_kwargs = {
            "name": assignment_seed["name"],
            "weight": assignment_seed["weight"],
            "earned": assignment_seed["earned"],
            "total": assignment_seed["total"],
            "drop_lowest": assignment_seed["drop_lowest"],
            "sort_order": assignment_seed["sort_order"],
            "extra_credit": assignment_seed["extra_credit"],
            "sub_items": assignment_seed["sub_items"],
        }
        if assignment_seed["client_id"] is not None:
            assignment_kwargs["client_id"] = assignment_seed["client_id"]
        course.assignments.append(Assignment(**assignment_kwargs))

    db.session.commit()

    return jsonify(_serialize_course(course)), 201


@api.route("/courses/<int:course_id>/", methods=["GET", "PATCH", "DELETE"])
def course_detail(course_id: int):
    user_id = _request_user_id()
    course = _course_for_user(course_id, user_id)
    if course is None:
        return jsonify({"detail": "Not found."}), 404

    if request.method == "GET":
        return jsonify(_serialize_course(course))

    if request.method == "DELETE":
        db.session.delete(course)
        db.session.commit()
        return "", 204

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    if "name" in payload:
        name = payload.get("name")
        if not isinstance(name, str):
            errors.setdefault("name", []).append("Not a valid string.")
        elif len(name) > 200:
            errors.setdefault("name", []).append("Ensure this field has no more than 200 characters.")
        else:
            course.name = name

    if "credits" in payload:
        credits = _parse_float(payload.get("credits"), "credits", errors, min_value=0)
        if "credits" not in errors:
            course.credits = credits

    if "is_pass_fail" in payload:
        is_pass_fail = _parse_bool(payload.get("is_pass_fail"), "is_pass_fail", errors)
        if "is_pass_fail" not in errors:
            course.is_pass_fail = is_pass_fail

    if "percent_boost" in payload:
        percent_boost = _parse_float(
            payload.get("percent_boost"), "percent_boost", errors, min_value=0, max_value=100
        )
        if "percent_boost" not in errors:
            course.percent_boost = percent_boost

    if "header_color" in payload:
        header_color = _parse_optional_short_string(payload.get("header_color"), "header_color", errors, 32)
        if "header_color" not in errors:
            course.header_color = header_color

    if "pass_label" in payload:
        pass_label = _parse_optional_short_string(payload.get("pass_label"), "pass_label", errors, 24)
        if "pass_label" not in errors:
            course.pass_label = pass_label or "P"

    if "fail_label" in payload:
        fail_label = _parse_optional_short_string(payload.get("fail_label"), "fail_label", errors, 24)
        if "fail_label" not in errors:
            course.fail_label = fail_label or "F"

    if "pass_threshold" in payload:
        pass_threshold = _parse_float(
            payload.get("pass_threshold"), "pass_threshold", errors, min_value=0, max_value=100
        )
        if "pass_threshold" not in errors:
            course.pass_threshold = pass_threshold

    if "letter_grade_scale" in payload:
        letter_grade_scale = _parse_grade_scale(
            payload.get("letter_grade_scale"), "letter_grade_scale", errors
        )
        if "letter_grade_scale" not in errors:
            course.letter_grade_scale = letter_grade_scale

    assignment_snapshot: list[dict[str, object]] | None = None
    if "assignments" in payload:
        assignments_payload = payload.get("assignments")
        assignment_snapshot = []
        if not isinstance(assignments_payload, list):
            errors.setdefault("assignments", []).append("Expected a list of assignment objects.")
        elif len(assignments_payload) > MAX_ASSIGNMENTS_PER_COURSE:
            errors.setdefault("assignments", []).append(
                f"Ensure this list has no more than {MAX_ASSIGNMENTS_PER_COURSE} items."
            )
        else:
            seen_client_ids: set[str] = set()
            for index, assignment_payload in enumerate(assignments_payload):
                parsed = _parse_assignment_seed(assignment_payload, index, errors)
                if parsed is None:
                    continue
                client_id = parsed.get("client_id")
                if not isinstance(client_id, str):
                    errors.setdefault(f"assignments[{index}].client_id", []).append(
                        "This field is required for a course snapshot."
                    )
                elif client_id in seen_client_ids:
                    errors.setdefault(f"assignments[{index}].client_id", []).append(
                        "Assignment client IDs must be unique."
                    )
                else:
                    seen_client_ids.add(client_id)
                assignment_snapshot.append(parsed)

    if errors:
        return jsonify(errors), 400

    if assignment_snapshot is not None:
        existing_by_client_id = {assignment.client_id: assignment for assignment in course.assignments}
        retained_ids: set[int] = set()
        for assignment_data in assignment_snapshot:
            client_id = assignment_data["client_id"]
            assignment = existing_by_client_id.get(client_id)
            if assignment is None:
                assignment = Assignment(client_id=client_id)
                course.assignments.append(assignment)
            elif assignment.id is not None:
                retained_ids.add(assignment.id)
            assignment.name = assignment_data["name"]
            assignment.weight = assignment_data["weight"]
            assignment.earned = assignment_data["earned"]
            assignment.total = assignment_data["total"]
            assignment.drop_lowest = assignment_data["drop_lowest"]
            assignment.sort_order = assignment_data["sort_order"]
            assignment.extra_credit = assignment_data["extra_credit"]
            assignment.sub_items = assignment_data["sub_items"]

        for existing in list(course.assignments):
            if existing.id not in retained_ids and existing.client_id not in {
                item["client_id"] for item in assignment_snapshot
            }:
                db.session.delete(existing)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"assignments": ["Assignment client IDs must be unique within a course."]}), 400
    return jsonify(_serialize_course(course))


@api.route("/assignments/", methods=["GET", "POST"])
def assignments_collection():
    user_id = _request_user_id()

    if request.method == "GET":
        assignments_query = (
            Assignment.query.join(Course, Assignment.course_id == Course.id)
            .join(Semester, Course.semester_id == Semester.id)
            .filter(Semester.user_id == user_id)
        )

        course_filter = request.args.get("course")
        if course_filter is not None:
            errors: dict[str, list[str]] = {}
            course_id = _parse_int(course_filter, "course", errors, min_value=1)
            if errors:
                return jsonify(errors), 400
            assignments_query = assignments_query.filter(Assignment.course_id == course_id)

        assignments = assignments_query.order_by(Assignment.created_at.asc()).all()
        return jsonify([_serialize_assignment(assignment) for assignment in assignments])

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    course_id = _parse_int(payload.get("course"), "course", errors, min_value=1)

    name = payload.get("name", "Assignment")
    if not isinstance(name, str):
        errors.setdefault("name", []).append("Not a valid string.")
    elif len(name) > 200:
        errors.setdefault("name", []).append("Ensure this field has no more than 200 characters.")

    weight = _parse_float(payload.get("weight"), "weight", errors, min_value=0, max_value=100)
    earned = _parse_float(payload.get("earned", 0), "earned", errors, min_value=0)
    total = _parse_float(payload.get("total", 100), "total", errors, min_value=0.01)
    drop_lowest = _parse_int(payload.get("drop_lowest", 0), "drop_lowest", errors, min_value=0)

    if errors:
        return jsonify(errors), 400

    course = _course_for_user(course_id, user_id)
    if course is None:
        # Keep this message compatible with the old backend behavior.
        return jsonify({"detail": "Cannot create assignments for another user's course."}), 403

    assignment = Assignment(
        course_id=course_id,
        name=name,
        weight=weight,
        earned=earned,
        total=total,
        drop_lowest=drop_lowest,
    )
    db.session.add(assignment)
    db.session.commit()

    return jsonify(_serialize_assignment(assignment)), 201


@api.route("/assignments/<int:assignment_id>/", methods=["GET", "PATCH", "DELETE"])
def assignment_detail(assignment_id: int):
    user_id = _request_user_id()
    assignment = _assignment_for_user(assignment_id, user_id)
    if assignment is None:
        return jsonify({"detail": "Not found."}), 404

    if request.method == "GET":
        return jsonify(_serialize_assignment(assignment))

    if request.method == "DELETE":
        db.session.delete(assignment)
        db.session.commit()
        return "", 204

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    if "name" in payload:
        name = payload.get("name")
        if not isinstance(name, str):
            errors.setdefault("name", []).append("Not a valid string.")
        elif len(name) > 200:
            errors.setdefault("name", []).append("Ensure this field has no more than 200 characters.")
        else:
            assignment.name = name

    if "weight" in payload:
        weight = _parse_float(payload.get("weight"), "weight", errors, min_value=0, max_value=100)
        if "weight" not in errors:
            assignment.weight = weight

    if "earned" in payload:
        earned = _parse_float(payload.get("earned"), "earned", errors, min_value=0)
        if "earned" not in errors:
            assignment.earned = earned

    if "total" in payload:
        total = _parse_float(payload.get("total"), "total", errors, min_value=0.01)
        if "total" not in errors:
            assignment.total = total

    if "drop_lowest" in payload:
        drop_lowest = _parse_int(payload.get("drop_lowest"), "drop_lowest", errors, min_value=0)
        if "drop_lowest" not in errors:
            assignment.drop_lowest = drop_lowest

    if errors:
        return jsonify(errors), 400

    db.session.commit()
    return jsonify(_serialize_assignment(assignment))


@api.route("/grade-scales/", methods=["GET", "POST"])
def grade_scales_collection():
    if request.method == "GET":
        grade_scales = GradeScale.query.order_by(GradeScale.min_percentage.desc()).all()
        return jsonify([_serialize_grade_scale(scale) for scale in grade_scales])

    forbidden = _admin_forbidden()
    if forbidden:
        return forbidden

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    letter = payload.get("letter")
    if not isinstance(letter, str) or len(letter.strip()) == 0:
        errors.setdefault("letter", []).append("This field is required.")
    elif len(letter) > 3:
        errors.setdefault("letter", []).append("Ensure this field has no more than 3 characters.")

    min_percentage = _parse_float(payload.get("min_percentage"), "min_percentage", errors, min_value=0, max_value=100)
    gpa_value = _parse_float(payload.get("gpa_value"), "gpa_value", errors, min_value=0, max_value=4.33)

    if errors:
        return jsonify(errors), 400

    grade_scale = GradeScale(letter=letter.strip(), min_percentage=min_percentage, gpa_value=gpa_value)
    db.session.add(grade_scale)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"detail": "Grade scale entry already exists."}), 400

    return jsonify(_serialize_grade_scale(grade_scale)), 201


@api.route("/grade-scales/<int:grade_scale_id>/", methods=["GET", "PATCH", "DELETE"])
def grade_scale_detail(grade_scale_id: int):
    grade_scale = GradeScale.query.filter_by(id=grade_scale_id).first()
    if grade_scale is None:
        return jsonify({"detail": "Not found."}), 404

    if request.method == "GET":
        return jsonify(_serialize_grade_scale(grade_scale))

    forbidden = _admin_forbidden()
    if forbidden:
        return forbidden

    if request.method == "DELETE":
        db.session.delete(grade_scale)
        db.session.commit()
        return "", 204

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    if "letter" in payload:
        letter = payload.get("letter")
        if not isinstance(letter, str) or len(letter.strip()) == 0:
            errors.setdefault("letter", []).append("This field may not be blank.")
        elif len(letter) > 3:
            errors.setdefault("letter", []).append("Ensure this field has no more than 3 characters.")
        else:
            grade_scale.letter = letter.strip()

    if "min_percentage" in payload:
        min_percentage = _parse_float(
            payload.get("min_percentage"),
            "min_percentage",
            errors,
            min_value=0,
            max_value=100,
        )
        if "min_percentage" not in errors:
            grade_scale.min_percentage = min_percentage

    if "gpa_value" in payload:
        gpa_value = _parse_float(payload.get("gpa_value"), "gpa_value", errors, min_value=0, max_value=4.33)
        if "gpa_value" not in errors:
            grade_scale.gpa_value = gpa_value

    if errors:
        return jsonify(errors), 400

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"detail": "Grade scale entry already exists."}), 400

    return jsonify(_serialize_grade_scale(grade_scale))


@api.route("/grade-scales/reset_default/", methods=["POST"])
def grade_scales_reset_default():
    forbidden = _admin_forbidden()
    if forbidden:
        return forbidden

    GradeScale.query.delete()

    for scale_data in DEFAULT_GRADE_SCALES:
        db.session.add(GradeScale(**scale_data))

    db.session.commit()

    grade_scales = GradeScale.query.order_by(GradeScale.min_percentage.desc()).all()
    return jsonify([_serialize_grade_scale(scale) for scale in grade_scales]), 201


# ── User Settings ───────────────────────────────────────────────────────────


def _serialize_user_state(row: UserSettings | None) -> dict:
    return {
        "dashboard_message": row.dashboard_message if row is not None else None,
        "last_active_semester_id": row.last_active_semester_id if row is not None else None,
        "local_migration_version": row.local_migration_version if row is not None else 0,
    }


@api.route("/user-state/", methods=["GET", "PATCH"])
def user_state():
    user_id = _request_user_id()
    row = _settings_for_user(user_id, create=request.method == "PATCH")
    if request.method == "GET":
        return jsonify(_serialize_user_state(row))

    payload = _json_payload()
    errors: dict[str, list[str]] = {}
    if "dashboard_message" in payload:
        message = payload.get("dashboard_message")
        if message is not None and (not isinstance(message, str) or len(message.strip()) > 240):
            errors.setdefault("dashboard_message", []).append("Must be null or a string of at most 240 characters.")
        else:
            row.dashboard_message = message.strip() if isinstance(message, str) and message.strip() else None

    if "last_active_semester_id" in payload:
        value = payload.get("last_active_semester_id")
        if value is None:
            row.last_active_semester_id = None
        else:
            semester_id = _parse_int(value, "last_active_semester_id", errors, min_value=1)
            if semester_id is not None:
                owned = Semester.query.filter_by(id=semester_id, user_id=user_id).first()
                if owned is None:
                    errors.setdefault("last_active_semester_id", []).append("Semester does not belong to this user.")
                else:
                    row.last_active_semester_id = semester_id

    if errors:
        db.session.rollback()
        return jsonify(errors), 400
    db.session.commit()
    return jsonify(_serialize_user_state(row))


def _save_legacy_backup(user_id: str, scope_key: str, payload: dict) -> None:
    backup = LegacyLocalBackup.query.filter_by(user_id=user_id, scope_key=scope_key).first()
    if backup is None:
        backup = LegacyLocalBackup(user_id=user_id, scope_key=scope_key, payload_json=payload)
        db.session.add(backup)
    else:
        backup.payload_json = payload


@api.route("/migration/local-v1/", methods=["POST"])
def migrate_local_v1():
    user_id = _request_user_id()
    request_payload = _json_payload()
    if len(json.dumps(request_payload)) > 1_000_000:
        return jsonify({"detail": "Migration payload too large."}), 400

    scope = request_payload.get("scope")
    payload = request_payload.get("payload", {})
    if scope not in {"user", "course", "finalize"} or not isinstance(payload, dict):
        return jsonify({"detail": "Invalid migration scope or payload."}), 400

    row = _settings_for_user(user_id, create=True)
    if row.local_migration_version >= LOCAL_MIGRATION_VERSION:
        return jsonify({"migrated": False, **_serialize_user_state(row)})

    errors: dict[str, list[str]] = {}
    if scope == "user":
        _save_legacy_backup(user_id, "user", payload)
        semesters = Semester.query.filter_by(user_id=user_id).all()
        semester_order = payload.get("semester_order")
        if semester_order is not None:
            _apply_exact_order(semesters, semester_order, "semester_order", errors)

        message = payload.get("dashboard_message")
        if message is not None:
            if not isinstance(message, str) or len(message.strip()) > 240:
                errors.setdefault("dashboard_message", []).append("Must be a string of at most 240 characters.")
            elif row.dashboard_message is None and message.strip():
                row.dashboard_message = message.strip()

        active = payload.get("active_semester_id")
        if active is None or active == "__dashboard__":
            row.last_active_semester_id = None
        else:
            active_id = _parse_int(active, "active_semester_id", errors, min_value=1)
            if active_id is not None:
                if not any(semester.id == active_id for semester in semesters):
                    errors.setdefault("active_semester_id", []).append("Semester does not belong to this user.")
                else:
                    row.last_active_semester_id = active_id

    elif scope == "course":
        course_id = _parse_int(request_payload.get("course_id"), "course_id", errors, min_value=1)
        course = _course_for_user(course_id, user_id) if course_id is not None else None
        if course is None and course_id is not None:
            errors.setdefault("course_id", []).append("Course does not belong to this user.")
        if not errors and course is not None:
            _save_legacy_backup(user_id, f"course:{course.id}", payload)
            if course.pass_label is None and isinstance(payload.get("passLabel"), str):
                course.pass_label = payload["passLabel"].strip()[:24] or "P"
            if course.fail_label is None and isinstance(payload.get("failLabel"), str):
                course.fail_label = payload["failLabel"].strip()[:24] or "F"
            if course.pass_threshold is None and "passThreshold" in payload:
                threshold = _parse_float(
                    payload.get("passThreshold"), "passThreshold", errors, min_value=0, max_value=100
                )
                if threshold is not None:
                    course.pass_threshold = threshold
            if course.letter_grade_scale is None:
                legacy_scale = payload.get("gradeScaleSnapshot") or payload.get("gradeScale")
                if legacy_scale is not None:
                    parsed_scale = _parse_grade_scale(legacy_scale, "gradeScale", errors)
                    if parsed_scale is not None:
                        course.letter_grade_scale = parsed_scale

            extras = payload.get("criterionExtras", {})
            if not isinstance(extras, dict):
                errors.setdefault("criterionExtras", []).append("Expected an object.")
            else:
                assignments_by_key = {
                    key: assignment
                    for assignment in course.assignments
                    for key in (assignment.client_id, str(assignment.id))
                }
                for key, extra in extras.items():
                    assignment = assignments_by_key.get(str(key))
                    if assignment is None or not isinstance(extra, dict):
                        continue
                    if assignment.extra_credit is None and "extraCredit" in extra:
                        parsed_extra = _parse_float(
                            extra.get("extraCredit"), f"criterionExtras.{key}.extraCredit", errors,
                            min_value=0, max_value=100,
                        )
                        if parsed_extra is not None:
                            assignment.extra_credit = parsed_extra
                    if assignment.sub_items is None and "subItems" in extra:
                        parsed_items = _parse_sub_items(
                            extra.get("subItems"), f"criterionExtras.{key}.subItems", errors
                        )
                        if parsed_items is not None:
                            assignment.sub_items = parsed_items

    else:
        if LegacyLocalBackup.query.filter_by(user_id=user_id, scope_key="user").first() is None:
            return jsonify({"detail": "User migration scope must succeed before finalization."}), 409
        _save_legacy_backup(user_id, "finalize", payload)
        row.local_migration_version = LOCAL_MIGRATION_VERSION

    if errors:
        db.session.rollback()
        return jsonify(errors), 400
    db.session.commit()
    return jsonify({"migrated": True, **_serialize_user_state(row)})


@api.route("/settings/", methods=["GET", "PUT"])
def user_settings():
    user_id = _request_user_id()

    row = _settings_for_user(user_id)

    if request.method == "GET":
        if row is None:
            return jsonify({})
        try:
            return jsonify(json.loads(row.settings_json))
        except (json.JSONDecodeError, TypeError):
            return jsonify({})

    # PUT — replace settings
    payload = _json_payload()
    settings_str = json.dumps(payload)
    if len(settings_str) > 50_000:
        return jsonify({"detail": "Settings payload too large."}), 400

    if row is None:
        row = UserSettings(user_id=user_id, settings_json=settings_str)
        db.session.add(row)
    else:
        row.settings_json = settings_str

    db.session.commit()
    return jsonify(json.loads(row.settings_json))


# ── Feedback ────────────────────────────────────────────────────────────────


def _serialize_feedback(fb: Feedback) -> dict:
    return {
        "id": fb.id,
        "user_id": fb.user_id,
        "rating": fb.rating,
        "comment": fb.comment,
        "completed": fb.completed,
        "created_at": _serialize_datetime(fb.created_at),
    }

@api.route("/feedback/", methods=["GET", "POST"])
def feedback_list():
    user_id = _request_user_id()

    if request.method == "POST":
        payload = _json_payload()
        rating = payload.get("rating")
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return jsonify({"detail": "rating must be an integer 1-5."}), 400
        comment = payload.get("comment", "")
        if not isinstance(comment, str):
            comment = ""
        fb = Feedback(user_id=user_id, rating=rating, comment=comment[:5000])
        db.session.add(fb)
        db.session.commit()
        return jsonify(_serialize_feedback(fb)), 201

    # GET — admin only
    forbidden = _admin_forbidden()
    if forbidden:
        return forbidden

    entries = Feedback.query.order_by(Feedback.completed.asc(), Feedback.created_at.desc()).all()
    return jsonify([_serialize_feedback(fb) for fb in entries])


@api.route("/feedback/<int:feedback_id>/", methods=["PATCH", "DELETE"])
def feedback_detail(feedback_id: int):
    forbidden = _admin_forbidden()
    if forbidden:
        return forbidden

    fb = Feedback.query.get_or_404(feedback_id)

    if request.method == "DELETE":
        db.session.delete(fb)
        db.session.commit()
        return "", 204

    payload = _json_payload()
    if "completed" in payload:
        fb.completed = bool(payload.get("completed"))
    db.session.commit()
    return jsonify(_serialize_feedback(fb))


# ── AI usage logging ──────────────────────────────────────────────────────────


@api.route("/ai-calls/", methods=["POST"])
def create_ai_call():
    # Internal-only: the app-level X-Internal-Api-Secret check already gates this.
    # Logged on behalf of the end user by our own server routes.
    payload = _json_payload()
    user_id = _request_user_id()

    def _as_int(value) -> int:
        try:
            return max(0, int(value))
        except (TypeError, ValueError):
            return 0

    def _as_float(value) -> float:
        try:
            return max(0.0, float(value))
        except (TypeError, ValueError):
            return 0.0

    call = AiCall(
        user_id=user_id,
        feature=str(payload.get("feature", "syllabus"))[:64],
        model=str(payload.get("model", ""))[:128],
        input_tokens=_as_int(payload.get("input_tokens")),
        output_tokens=_as_int(payload.get("output_tokens")),
        cost_usd=_as_float(payload.get("cost_usd")),
    )
    db.session.add(call)
    db.session.commit()
    return jsonify({"id": call.id}), 201


# ── Admin platform stats ──────────────────────────────────────────────────────


@api.route("/admin/stats/", methods=["GET"])
def admin_stats():
    forbidden = _admin_forbidden()
    if forbidden:
        return forbidden

    today = datetime.now(timezone.utc).date()

    try:
        window_days = int(request.args.get("days", 30))
    except (TypeError, ValueError):
        window_days = 30
    window_days = max(1, min(365, window_days))

    def active_window(days: int) -> int:
        cutoff = today - timedelta(days=days - 1)
        return (
            db.session.query(func.count(func.distinct(UserActivity.user_id)))
            .filter(
                UserActivity.activity_date >= cutoff,
                UserActivity.user_id != "default",
            )
            .scalar()
            or 0
        )

    dau = active_window(1)
    wau = active_window(7)
    mau = active_window(30)

    # ── First observed per user, merged across CourseGrade data sources ───────
    first_seen: dict[str, date] = {}

    def consider(user_id: str | None, value: date | None) -> None:
        if not user_id or user_id == "default" or value is None:
            return
        current = first_seen.get(user_id)
        if current is None or value < current:
            first_seen[user_id] = value

    for uid, d in db.session.query(
        UserActivity.user_id, func.min(UserActivity.activity_date)
    ).group_by(UserActivity.user_id):
        consider(uid, d)

    for uid, dt in db.session.query(
        Semester.user_id, func.min(Semester.created_at)
    ).group_by(Semester.user_id):
        consider(uid, dt.date() if dt else None)

    for uid, dt in db.session.query(
        UserSettings.user_id, func.min(UserSettings.created_at)
    ).group_by(UserSettings.user_id):
        consider(uid, dt.date() if dt else None)

    observed_users = len(first_seen)

    window_start = today - timedelta(days=window_days - 1)

    # This is not an auth-provider signup timestamp. It is the earliest date on
    # which CourseGrade persisted activity/settings/semester data for the user.
    first_seen_counts: dict[date, int] = {}
    for d in first_seen.values():
        first_seen_counts[d] = first_seen_counts.get(d, 0) + 1

    first_seen_trend = []
    for offset in range(window_days - 1, -1, -1):
        day = today - timedelta(days=offset)
        first_seen_trend.append(
            {"date": day.isoformat(), "count": first_seen_counts.get(day, 0)}
        )

    # ── Active-users trend (zero-filled over selected window) ─────────────────
    active_rows = (
        db.session.query(
            UserActivity.activity_date,
            func.count(func.distinct(UserActivity.user_id)),
        )
        .filter(
            UserActivity.activity_date >= window_start,
            UserActivity.user_id != "default",
        )
        .group_by(UserActivity.activity_date)
        .all()
    )
    active_map = {row[0]: row[1] for row in active_rows}

    active_trend = []
    for offset in range(window_days - 1, -1, -1):
        day = today - timedelta(days=offset)
        active_trend.append(
            {"date": day.isoformat(), "count": active_map.get(day, 0)}
        )

    # ── AI usage ──────────────────────────────────────────────────────────────
    ai_totals = db.session.query(
        func.count(AiCall.id),
        func.coalesce(func.sum(AiCall.cost_usd), 0.0),
        func.coalesce(func.sum(AiCall.input_tokens + AiCall.output_tokens), 0),
    ).one()
    ai_total_calls = int(ai_totals[0] or 0)
    ai_total_cost = round(float(ai_totals[1] or 0.0), 4)
    ai_total_tokens = int(ai_totals[2] or 0)

    ai_rows = (
        db.session.query(
            func.date(AiCall.created_at),
            func.count(AiCall.id),
            func.coalesce(func.sum(AiCall.cost_usd), 0.0),
        )
        .filter(
            AiCall.created_at
            >= datetime.now(timezone.utc) - timedelta(days=window_days - 1)
        )
        .group_by(func.date(AiCall.created_at))
        .all()
    )

    def _as_date(value) -> date | None:
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return None
        return None

    ai_calls_map: dict[date, int] = {}
    ai_cost_map: dict[date, float] = {}
    for raw_day, calls, cost in ai_rows:
        day = _as_date(raw_day)
        if day is None:
            continue
        ai_calls_map[day] = int(calls or 0)
        ai_cost_map[day] = float(cost or 0.0)

    ai_trend = []
    for offset in range(window_days - 1, -1, -1):
        day = today - timedelta(days=offset)
        ai_trend.append(
            {
                "date": day.isoformat(),
                "calls": ai_calls_map.get(day, 0),
                "cost": round(ai_cost_map.get(day, 0.0), 4),
            }
        )

    ai_by_model = [
        {
            "model": model or "unknown",
            "calls": int(calls or 0),
            "cost": round(float(cost or 0.0), 4),
        }
        for model, calls, cost in db.session.query(
            AiCall.model,
            func.count(AiCall.id),
            func.coalesce(func.sum(AiCall.cost_usd), 0.0),
        )
        .group_by(AiCall.model)
        .all()
    ]

    return jsonify(
        {
            "observed_users": observed_users,
            "window_days": window_days,
            "dau": dau,
            "wau": wau,
            "mau": mau,
            "first_seen_trend": first_seen_trend,
            "active_trend": active_trend,
            "ai_total_calls": ai_total_calls,
            "ai_total_cost": ai_total_cost,
            "ai_total_tokens": ai_total_tokens,
            "ai_trend": ai_trend,
            "ai_by_model": ai_by_model,
        }
    )
