from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Semester, Course, Assignment, GradeScale
from .serializers import (
    SemesterSerializer, 
    CourseSerializer, 
    CourseCreateSerializer,
    AssignmentSerializer, 
    GradeScaleSerializer
)


class SemesterViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing semesters.
    Provides CRUD operations for semesters.
    """
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a semester with all its courses and assignments."""
        semester = self.get_object()
        new_semester = Semester.objects.create(name=f"{semester.name} (Copy)")
        
        for course in semester.courses.all():
            new_course = Course.objects.create(
                semester=new_semester,
                name=course.name,
                credits=course.credits
            )
            for assignment in course.assignments.all():
                Assignment.objects.create(
                    course=new_course,
                    name=assignment.name,
                    weight=assignment.weight,
                    earned=assignment.earned,
                    total=assignment.total
                )
        
        serializer = self.get_serializer(new_semester)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing courses.
    Provides CRUD operations for courses.
    """
    queryset = Course.objects.all()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CourseCreateSerializer
        return CourseSerializer

    def get_queryset(self):
        queryset = Course.objects.all()
        semester_id = self.request.query_params.get('semester', None)
        if semester_id is not None:
            queryset = queryset.filter(semester_id=semester_id)
        return queryset


class AssignmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing assignments.
    Provides CRUD operations for assignments.
    """
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer

    def get_queryset(self):
        queryset = Assignment.objects.all()
        course_id = self.request.query_params.get('course', None)
        if course_id is not None:
            queryset = queryset.filter(course_id=course_id)
        return queryset


class GradeScaleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing grade scales.
    Provides CRUD operations for grade scale entries.
    """
    queryset = GradeScale.objects.all()
    serializer_class = GradeScaleSerializer

    @action(detail=False, methods=['post'])
    def reset_default(self, request):
        """Reset grade scale to default values."""
        GradeScale.objects.all().delete()
        
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
        
        serializer = self.get_serializer(GradeScale.objects.all(), many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
