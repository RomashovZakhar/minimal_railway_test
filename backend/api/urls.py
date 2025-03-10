from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from users.views import UserViewSet, RegisterView, VerifyEmailView
from documents.views import DocumentViewSet
from tasks.views import TaskViewSet

# Создаем маршрутизатор
router = DefaultRouter()
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    # Маршруты для аутентификации
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    
    # Включаем URL-адреса из роутера
    path('', include(router.urls)),
    # Убираем несуществующие импорты
    # path('', include('documents.urls')),
    # path('', include('users.urls')),
] 