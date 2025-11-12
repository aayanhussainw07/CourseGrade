from rest_framework import serializers
from .models import Semester, Course, Assignment, GradeScale


class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer for Assignment model."""
    
    class Meta:
        model = Assignment
        fields = ['id', 'course', 'name', 'weight', 'earned', 'total', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CourseSerializer(serializers.ModelSerializer):
    """Serializer for Course model with nested assignments."""
    assignments = AssignmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Course
        fields = ['id', 'semester', 'name', 'credits', 'assignments', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CourseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating courses without nested data."""
    
    class Meta:
        model = Course
        fields = ['id', 'semester', 'name', 'credits', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class SemesterSerializer(serializers.ModelSerializer):
    """Serializer for Semester model with nested courses."""
    courses = CourseSerializer(many=True, read_only=True)
    
    class Meta:
        model = Semester
        fields = ['id', 'name', 'user_id', 'courses', 'created_at', 'updated_at']
        read_only_fields = ['user_id', 'created_at', 'updated_at']


class GradeScaleSerializer(serializers.ModelSerializer):
    """Serializer for GradeScale model."""
    
    class Meta:
        model = GradeScale
        fields = ['id', 'letter', 'min_percentage', 'gpa_value', 'created_at']
        read_only_fields = ['created_at']
