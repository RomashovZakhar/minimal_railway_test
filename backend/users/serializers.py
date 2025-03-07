from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели пользователя
    """
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_email_verified', 'telegram_id', 'avatar']
        read_only_fields = ['is_email_verified']

class RegisterSerializer(serializers.ModelSerializer):
    """
    Сериализатор для регистрации пользователей
    """
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Пароли не совпадают"})
        return attrs
    
    def create(self, validated_data):
        # Удаляем password_confirm, так как мы его не сохраняем
        validated_data.pop('password_confirm')
        
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        user.set_password(validated_data['password'])
        user.save()
        
        return user

class VerifyEmailSerializer(serializers.Serializer):
    """
    Сериализатор для подтверждения email
    """
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(required=True) 