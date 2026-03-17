from __future__ import annotations

from datetime import date, datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import Assignment, Course, GradeScale, Semester

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


def _request_user_id() -> str:
    user_id = request.headers.get("X-User-Id", "").strip()
    return user_id or "default"


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
        "created_at": _serialize_datetime(assignment.created_at),
        "updated_at": _serialize_datetime(assignment.updated_at),
    }


def _serialize_course(course: Course) -> dict:
    assignments = sorted(course.assignments, key=lambda assignment: assignment.created_at)
    return {
        "id": course.id,
        "semester": course.semester_id,
        "name": course.name,
        "credits": course.credits,
        "is_pass_fail": course.is_pass_fail,
        "percent_boost": course.percent_boost,
        "assignments": [_serialize_assignment(assignment) for assignment in assignments],
        "created_at": _serialize_datetime(course.created_at),
        "updated_at": _serialize_datetime(course.updated_at),
    }


def _serialize_semester(semester: Semester) -> dict:
    courses = sorted(semester.courses, key=lambda course: course.created_at)
    return {
        "id": semester.id,
        "name": semester.name,
        "user_id": semester.user_id,
        "background": semester.background,
        "timeline_date": _serialize_date(semester.timeline_date),
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

    name = value.get("name", "Assignment")
    if not isinstance(name, str):
        errors.setdefault(name_field, []).append("Not a valid string.")
    elif len(name) > 200:
        errors.setdefault(name_field, []).append("Ensure this field has no more than 200 characters.")

    weight = _parse_float(value.get("weight"), weight_field, errors, min_value=0, max_value=100)
    earned = _parse_float(value.get("earned", 0), earned_field, errors, min_value=0)
    total = _parse_float(value.get("total", 100), total_field, errors, min_value=0.01)
    drop_lowest = _parse_int(value.get("drop_lowest", 0), drop_lowest_field, errors, min_value=0)

    if any(key.startswith(base_field) for key in errors):
        return None

    return {
        "name": name,
        "weight": weight,
        "earned": earned,
        "total": total,
        "drop_lowest": drop_lowest,
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


@api.route("/health/", methods=["GET"])
def healthcheck():
    return jsonify({"status": "ok"})


@api.route("/semesters/", methods=["GET", "POST"])
def semesters_collection():
    user_id = _request_user_id()

    if request.method == "GET":
        semesters = Semester.query.filter_by(user_id=user_id).order_by(Semester.created_at.desc()).all()
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

    if errors:
        return jsonify(errors), 400

    semester = Semester(
        name=name,
        user_id=user_id,
        background=background,
        timeline_date=timeline_date,
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

    if errors:
        return jsonify(errors), 400

    db.session.commit()
    return jsonify(_serialize_semester(semester))


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
    )
    db.session.add(duplicate)
    db.session.flush()

    courses = Course.query.filter_by(semester_id=semester.id).order_by(Course.created_at.asc()).all()
    for course in courses:
        copied_course = Course(
            semester_id=duplicate.id,
            name=course.name,
            credits=course.credits,
            is_pass_fail=course.is_pass_fail,
            percent_boost=course.percent_boost,
        )
        db.session.add(copied_course)
        db.session.flush()

        assignments = Assignment.query.filter_by(course_id=course.id).order_by(Assignment.created_at.asc()).all()
        for assignment in assignments:
            db.session.add(
                Assignment(
                    course_id=copied_course.id,
                    name=assignment.name,
                    weight=assignment.weight,
                    earned=assignment.earned,
                    total=assignment.total,
                    drop_lowest=assignment.drop_lowest,
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

        courses = courses_query.order_by(Course.created_at.asc()).all()
        return jsonify([_serialize_course(course) for course in courses])

    payload = _json_payload()
    errors: dict[str, list[str]] = {}

    semester_id = _parse_int(payload.get("semester"), "semester", errors, min_value=1)

    name = payload.get("name", "New Course")
    if not isinstance(name, str):
        errors.setdefault("name", []).append("Not a valid string.")
    elif len(name) > 200:
        errors.setdefault("name", []).append("Ensure this field has no more than 200 characters.")

    credits = _parse_int(payload.get("credits", 3), "credits", errors)

    is_pass_fail = _parse_bool(payload.get("is_pass_fail", False), "is_pass_fail", errors)

    percent_boost = _parse_float(payload.get("percent_boost", 0), "percent_boost", errors, min_value=0, max_value=100)

    assignment_seeds_payload = payload.get("assignments")
    assignment_seeds: list[dict[str, object]] = []
    if assignment_seeds_payload is not None:
        if not isinstance(assignment_seeds_payload, list):
            errors.setdefault("assignments", []).append("Expected a list of assignment objects.")
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

    course = Course(
        semester_id=semester_id,
        name=name,
        credits=credits,
        is_pass_fail=is_pass_fail,
        percent_boost=percent_boost,
    )
    db.session.add(course)

    for assignment_seed in assignment_seeds:
        course.assignments.append(
            Assignment(
                name=assignment_seed["name"],
                weight=assignment_seed["weight"],
                earned=assignment_seed["earned"],
                total=assignment_seed["total"],
                drop_lowest=assignment_seed["drop_lowest"],
            )
        )

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
        credits = _parse_int(payload.get("credits"), "credits", errors)
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

    if errors:
        return jsonify(errors), 400

    db.session.commit()
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
    GradeScale.query.delete()

    for scale_data in DEFAULT_GRADE_SCALES:
        db.session.add(GradeScale(**scale_data))

    db.session.commit()

    grade_scales = GradeScale.query.order_by(GradeScale.min_percentage.desc()).all()
    return jsonify([_serialize_grade_scale(scale) for scale in grade_scales]), 201
