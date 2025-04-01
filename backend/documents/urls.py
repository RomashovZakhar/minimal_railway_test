from django.urls import path, re_path, include
from .views import DocumentViewSet, AccessRightViewSet
from rest_framework.routers import DefaultRouter

# Создаем маршруты REST API
router = DefaultRouter()
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'access-rights', AccessRightViewSet, basename='access-right')

urlpatterns = [
    path('', include(router.urls)),
] 