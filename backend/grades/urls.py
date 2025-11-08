from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SemesterViewSet, CourseViewSet, AssignmentViewSet, GradeScaleViewSet

router = DefaultRouter()
router.register(r'semesters', SemesterViewSet, basename='semester')
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'assignments', AssignmentViewSet, basename='assignment')
router.register(r'grade-scales', GradeScaleViewSet, basename='gradescale')

urlpatterns = [
    path('', include(router.urls)),
]
