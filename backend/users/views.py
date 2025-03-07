from django.shortcuts import render
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, RegisterSerializer, VerifyEmailSerializer
import random
import string

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint для пользователей
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        """
        Переопределяем разрешения в зависимости от действия
        """
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        Endpoint для получения текущего пользователя
        """
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def connect_telegram(self, request, pk=None):
        """
        Подключение Telegram к аккаунту
        """
        if str(request.user.id) != pk:
            return Response(
                {"detail": "Вы можете изменять только свой профиль"},
                status=status.HTTP_403_FORBIDDEN
            )
            
        telegram_id = request.data.get('telegram_id')
        if not telegram_id:
            return Response(
                {"detail": "Telegram ID не предоставлен"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        user.telegram_id = telegram_id
        user.save()
        
        return Response({"detail": "Telegram успешно подключен"})

class RegisterView(generics.CreateAPIView):
    """
    API endpoint для регистрации новых пользователей
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Создаем пользователя
        user = serializer.save()
        
        # Генерируем OTP-код и сохраняем его (в реальном проекте нужно отправить на email)
        otp = ''.join(random.choices(string.digits, k=6))
        user.otp = otp  # В реальном проекте нужно добавить это поле или использовать кэш/Redis
        user.save()
        
        return Response({
            "detail": "Пользователь создан. Проверьте email для подтверждения.",
            "email": user.email,
            "otp": otp  # В продакшен-версии нужно убрать, здесь для удобства разработки
        }, status=status.HTTP_201_CREATED)

class VerifyEmailView(generics.GenericAPIView):
    """
    API endpoint для подтверждения email
    """
    permission_classes = [AllowAny]
    serializer_class = VerifyEmailSerializer
    
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']
        
        try:
            user = User.objects.get(email=email)
            
            # В реальном проекте нужно проверить OTP из кэша/Redis
            if user.otp == otp:  # Используем поле otp, которое мы добавили в RegisterView
                user.is_email_verified = True
                user.save()
                return Response({"detail": "Email успешно подтвержден."}, status=status.HTTP_200_OK)
            else:
                return Response({"detail": "Неверный код подтверждения."}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_404_NOT_FOUND)
