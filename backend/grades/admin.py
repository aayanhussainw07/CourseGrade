from django.contrib import admin
from .models import Semester, Course, Assignment, GradeScale

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['name', 'semester', 'credits']
    list_filter = ['semester']
    search_fields = ['name']

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'course', 'weight', 'earned', 'total']
    list_filter = ['course']
    search_fields = ['name']

@admin.register(GradeScale)
class GradeScaleAdmin(admin.ModelAdmin):
    list_display = ['letter', 'min_percentage', 'gpa_value']
    ordering = ['-min_percentage']
