from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Semester(models.Model):
    """Represents an academic semester containing multiple courses."""
    name = models.CharField(max_length=200, default="New Semester")
    user_id = models.CharField(max_length=255, default="default", db_index=True)
    background = models.CharField(max_length=50, default="sunrise")
    timeline_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Course(models.Model):
    """Represents a course within a semester."""
    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE,
        related_name='courses'
    )
    name = models.CharField(max_length=200, default="New Course")
    credits = models.IntegerField(default=3)
    is_pass_fail = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.name} ({self.semester.name})"


class Assignment(models.Model):
    """Represents an assignment or grade category within a course."""
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    name = models.CharField(max_length=200, default="Assignment")
    weight = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    earned = models.FloatField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    total = models.FloatField(
        default=100,
        validators=[MinValueValidator(0.01)]
    )
    drop_lowest = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.name} - {self.course.name}"


class GradeScale(models.Model):
    """Represents a grade scale entry (e.g., A+ = 96-100%)."""
    letter = models.CharField(max_length=3)
    min_percentage = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    gpa_value = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(4.3)]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-min_percentage']
        unique_together = ['letter', 'min_percentage']

    def __str__(self):
        return f"{self.letter} ({self.min_percentage}%)"
