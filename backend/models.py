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

    courses = db.relationship(
        "Course",
        back_populates="semester",
        cascade="all, delete-orphan",
        order_by="Course.created_at",
        lazy="selectin",
    )


class Course(TimestampMixin, db.Model):
    __tablename__ = "courses"

    id = db.Column(db.Integer, primary_key=True)
    semester_id = db.Column(db.Integer, db.ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, default="New Course")
    credits = db.Column(db.Integer, nullable=False, default=3)
    is_pass_fail = db.Column(db.Boolean, nullable=False, default=False)
    percent_boost = db.Column(db.Float, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint("percent_boost >= 0 AND percent_boost <= 100", name="courses_percent_boost_range"),
    )

    semester = db.relationship("Semester", back_populates="courses", lazy="joined")
    assignments = db.relationship(
        "Assignment",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="Assignment.created_at",
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

    __table_args__ = (
        CheckConstraint("weight >= 0 AND weight <= 100", name="assignments_weight_range"),
        CheckConstraint("earned >= 0", name="assignments_earned_min"),
        CheckConstraint("total >= 0.01", name="assignments_total_min"),
        CheckConstraint("drop_lowest >= 0", name="assignments_drop_lowest_min"),
    )

    course = db.relationship("Course", back_populates="assignments", lazy="joined")


class GradeScale(db.Model):
    __tablename__ = "grade_scales"

    id = db.Column(db.Integer, primary_key=True)
    letter = db.Column(db.String(3), nullable=False)
    min_percentage = db.Column(db.Float, nullable=False)
    gpa_value = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("letter", "min_percentage", name="grade_scales_letter_min_percentage_unique"),
        CheckConstraint("min_percentage >= 0 AND min_percentage <= 100", name="grade_scales_min_percentage_range"),
        CheckConstraint("gpa_value >= 0 AND gpa_value <= 4.33", name="grade_scales_gpa_value_range"),
    )
