from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from users.views import UserViewSet, RegisterView, VerifyEmailView
from documents.views import DocumentViewSet
from tasks.views import TaskViewSet

# Создаем роутер для API
router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'documents', DocumentViewSet)
router.register(r'tasks', TaskViewSet)

urlpatterns = [
    # Маршруты для аутентификации
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    
    # Включаем URL-адреса из роутера
    path('', include(router.urls)),
] 