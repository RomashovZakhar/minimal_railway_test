from django.urls import path, re_path, include
from .views import DocumentViewSet
from rest_framework.routers import DefaultRouter

# Создаем маршруты REST API
router = DefaultRouter()
router.register(r'documents', DocumentViewSet, basename='document')

urlpatterns = [
    path('', include(router.urls)),
] 