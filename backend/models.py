import uuid

from sqlalchemy import CheckConstraint, UniqueConstraint, func

from extensions import db


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Semester(TimestampMixin, db.Model):
    __tablename__ = "semesters"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, default="New Semester")
    user_id = db.Column(db.String(255), nullable=False, default="default", index=True)
    background = db.Column(db.String(50), nullable=False, default="sunrise")
    timeline_date = db.Column(db.Date, nullable=True)
    ignored = db.Column(db.Boolean, nullable=False, default=False, server_default="false")
    sort_order = db.Column(db.Integer, nullable=False, default=0, server_default="0")

    courses = db.relationship(
        "Course",
        back_populates="semester",
        cascade="all, delete-orphan",
        order_by="(Course.sort_order, Course.id)",
        lazy="selectin",
    )


class Course(TimestampMixin, db.Model):
    __tablename__ = "courses"

    id = db.Column(db.Integer, primary_key=True)
    semester_id = db.Column(db.Integer, db.ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, default="New Course")
    credits = db.Column(db.Float, nullable=False, default=3)
    is_pass_fail = db.Column(db.Boolean, nullable=False, default=False)
    percent_boost = db.Column(db.Float, nullable=False, default=0)
    header_color = db.Column(db.String(32), nullable=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    pass_label = db.Column(db.String(24), nullable=True)
    fail_label = db.Column(db.String(24), nullable=True)
    pass_threshold = db.Column(db.Float, nullable=True)
    pass_color = db.Column(db.String(7), nullable=True)
    fail_color = db.Column(db.String(7), nullable=True)
    letter_grade_scale = db.Column(db.JSON, nullable=True)

    __table_args__ = (
        CheckConstraint("percent_boost >= 0 AND percent_boost <= 100", name="courses_percent_boost_range"),
        CheckConstraint(
            "pass_threshold IS NULL OR (pass_threshold >= 0 AND pass_threshold <= 100)",
            name="courses_pass_threshold_range",
        ),
    )

    semester = db.relationship("Semester", back_populates="courses", lazy="joined")
    assignments = db.relationship(
        "Assignment",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="(Assignment.sort_order, Assignment.id)",
        lazy="selectin",
    )


class Assignment(TimestampMixin, db.Model):
    __tablename__ = "assignments"

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, default="Assignment")
    weight = db.Column(db.Float, nullable=False)
    earned = db.Column(db.Float, nullable=False, default=0)
    total = db.Column(db.Float, nullable=False, default=100)
    drop_lowest = db.Column(db.Integer, nullable=False, default=0)
    client_id = db.Column(db.String(64), nullable=False, default=lambda: str(uuid.uuid4()))
    sort_order = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    extra_credit = db.Column(db.Float, nullable=True)
    sub_items = db.Column(db.JSON, nullable=True)

    __table_args__ = (
        CheckConstraint("weight >= 0 AND weight <= 100", name="assignments_weight_range"),
        CheckConstraint("earned >= 0", name="assignments_earned_min"),
        CheckConstraint("total >= 0.01", name="assignments_total_min"),
        CheckConstraint("drop_lowest >= 0", name="assignments_drop_lowest_min"),
        CheckConstraint(
            "extra_credit IS NULL OR (extra_credit >= 0 AND extra_credit <= 100)",
            name="assignments_extra_credit_range",
        ),
        UniqueConstraint("course_id", "client_id", name="assignments_course_client_id_unique"),
    )

    course = db.relationship("Course", back_populates="assignments", lazy="joined")


class UserSettings(TimestampMixin, db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), nullable=False, unique=True, index=True)
    settings_json = db.Column(db.Text, nullable=False, default="{}")
    dashboard_message = db.Column(db.String(240), nullable=True)
    last_active_semester_id = db.Column(db.Integer, nullable=True)
    local_migration_version = db.Column(db.Integer, nullable=False, default=0, server_default="0")


class LegacyLocalBackup(TimestampMixin, db.Model):
    __tablename__ = "legacy_local_backups"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), nullable=False, index=True)
    scope_key = db.Column(db.String(255), nullable=False)
    payload_json = db.Column(db.JSON, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "scope_key", name="legacy_local_backups_user_scope_unique"),
    )


class Feedback(TimestampMixin, db.Model):
    __tablename__ = "feedback"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), nullable=False, index=True)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=False, default="")
    completed = db.Column(db.Boolean, nullable=False, default=False, server_default="false")

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="feedback_rating_range"),
    )


class UserActivity(db.Model):
    __tablename__ = "user_activity"

    user_id = db.Column(db.String(255), primary_key=True)
    activity_date = db.Column(db.Date, primary_key=True)

    __table_args__ = (
        db.Index("ix_user_activity_date", "activity_date"),
    )


class AiCall(TimestampMixin, db.Model):
    __tablename__ = "ai_calls"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), nullable=False, default="default", index=True)
    feature = db.Column(db.String(64), nullable=False, default="syllabus")
    model = db.Column(db.String(128), nullable=False, default="")
    input_tokens = db.Column(db.Integer, nullable=False, default=0)
    output_tokens = db.Column(db.Integer, nullable=False, default=0)
    cost_usd = db.Column(db.Float, nullable=False, default=0)

    __table_args__ = (
        db.Index("ix_ai_calls_created_at", "created_at"),
    )


class GradeScale(db.Model):
    __tablename__ = "grade_scales"

    id = db.Column(db.Integer, primary_key=True)
    letter = db.Column(db.String(8), nullable=False)
    min_percentage = db.Column(db.Float, nullable=False)
    gpa_value = db.Column(db.Float, nullable=False)
    color = db.Column(db.String(7), nullable=False, default="#888888", server_default="#888888")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("letter", "min_percentage", name="grade_scales_letter_min_percentage_unique"),
        CheckConstraint("min_percentage >= 0 AND min_percentage <= 100", name="grade_scales_min_percentage_range"),
        CheckConstraint("gpa_value >= 0", name="grade_scales_gpa_value_nonnegative"),
    )
