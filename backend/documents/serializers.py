from rest_framework import serializers
from .models import Document, AccessRight, DocumentHistory
from django.contrib.auth import get_user_model

User = get_user_model()

class DocumentSerializer(serializers.ModelSerializer):
    """
    Базовый сериализатор для документов
    """
    owner_username = serializers.ReadOnlyField(source='owner.username')
    
    class Meta:
        model = Document
        fields = ['id', 'title', 'created_at', 'updated_at', 'owner', 'owner_username', 'parent', 'is_favorite']
        read_only_fields = ['owner', 'created_at', 'updated_at']

class DocumentDetailSerializer(serializers.ModelSerializer):
    """
    Детальный сериализатор для документа, включающий содержимое
    """
    owner_username = serializers.ReadOnlyField(source='owner.username')
    children = DocumentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Document
        fields = ['id', 'title', 'content', 'created_at', 'updated_at', 'owner', 'owner_username', 'parent', 'children', 'is_favorite']
        read_only_fields = ['owner', 'created_at', 'updated_at']

class UserBasicSerializer(serializers.ModelSerializer):
    """
    Базовый сериализатор для пользователя (для использования в других сериализаторах)
    """
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class AccessRightSerializer(serializers.ModelSerializer):
    """
    Сериализатор для прав доступа
    """
    user_details = UserBasicSerializer(source='user', read_only=True)
    
    class Meta:
        model = AccessRight
        fields = ['id', 'document', 'user', 'user_details', 'role', 'include_children', 'created_at']
        read_only_fields = ['created_at']
        extra_kwargs = {
            'document': {'write_only': True},
            'user': {'write_only': True}
        }
    
    def validate_user(self, value):
        """
        Проверяем, что пользователь существует и не является владельцем документа
        """
        document_id = self.initial_data.get('document')
        if document_id:
            try:
                document = Document.objects.get(id=document_id)
                if document.owner == value:
                    raise serializers.ValidationError("Нельзя предоставить доступ владельцу документа")
            except Document.DoesNotExist:
                pass  # Валидация document_id выполняется отдельно
        
        return value

class DocumentHistorySerializer(serializers.ModelSerializer):
    """
    Сериализатор для истории изменений документа
    """
    user_details = UserBasicSerializer(source='user', read_only=True)
    
    class Meta:
        model = DocumentHistory
        fields = ['id', 'document', 'user', 'user_details', 'changes', 'created_at']
        read_only_fields = ['created_at'] 