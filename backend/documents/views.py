from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Document, AccessRight
from .serializers import DocumentSerializer, DocumentDetailSerializer, AccessRightSerializer

class DocumentViewSet(viewsets.ModelViewSet):
    """
    API endpoint для работы с документами
    """
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    
    def get_serializer_class(self):
        """
        Возвращает разные сериализаторы в зависимости от действия
        """
        if self.action == 'retrieve':
            return DocumentDetailSerializer
        return DocumentSerializer
    
    def get_queryset(self):
        """
        Возвращает документы, доступные текущему пользователю
        """
        user = self.request.user
        
        # Проверяем параметр root для получения корневых документов
        root = self.request.query_params.get('root', None)
        if root and root.lower() == 'true':
            # Сначала проверяем, есть ли документы с явным флагом is_root=True
            root_docs = Document.objects.filter(owner=user, is_root=True)
            if root_docs.exists():
                # Возвращаем документы с флагом is_root=True
                return root_docs
            
            # Если таких нет, возвращаем документы с parent=None
            return Document.objects.filter(owner=user, parent=None).order_by('id')
        
        # Документы, которые пользователь создал
        own_documents = Q(owner=user)
        
        # Документы, к которым у пользователя есть доступ
        access_documents = Q(access_rights__user=user)
        
        # Объединяем и исключаем дубликаты
        return Document.objects.filter(own_documents | access_documents).distinct()
    
    def perform_create(self, serializer):
        """
        Устанавливаем текущего пользователя как владельца при создании
        """
        # Если создается корневой документ (is_root=True), проверяем, нет ли уже такого
        is_root = serializer.validated_data.get('is_root', False)
        if is_root:
            # Проверяем, существует ли уже корневой документ у этого пользователя
            existing_root = Document.objects.filter(owner=self.request.user, is_root=True).first()
            if existing_root:
                # Если уже есть корневой документ, отменяем флаг is_root для нового документа
                serializer.validated_data['is_root'] = False
                # Логируем информацию
                print(f"Попытка создать второй корневой документ для пользователя {self.request.user.id}: отменено")
        
        # Если создается документ с parent=None (верхнего уровня)
        parent = serializer.validated_data.get('parent', None)
        if parent is None and not is_root:
            # Проверяем, есть ли уже корневой документ (is_root=True)
            existing_root = Document.objects.filter(owner=self.request.user, is_root=True).first()
            if not existing_root:
                # Если нет явного корневого документа, проверяем документы верхнего уровня
                root_docs = Document.objects.filter(owner=self.request.user, parent=None)
                if not root_docs.exists():
                    # Если нет других документов верхнего уровня, помечаем этот как корневой
                    serializer.validated_data['is_root'] = True
                    print(f"Автоматически установлен флаг is_root=True для документа пользователя {self.request.user.id}")
        
        serializer.save(owner=self.request.user)
    
    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        """
        Добавление/удаление документа из избранного
        """
        document = self.get_object()
        document.is_favorite = not document.is_favorite
        document.save()
        
        serializer = self.get_serializer(document)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        """
        Предоставление доступа к документу другому пользователю
        """
        document = self.get_object()
        
        # Проверяем, является ли текущий пользователь владельцем документа
        if document.owner != request.user:
            return Response(
                {"detail": "Только владелец документа может предоставлять доступ"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Создаем сериализатор для данных запроса
        serializer = AccessRightSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(document=document)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def access_rights(self, request, pk=None):
        """
        Получение списка прав доступа к документу
        """
        document = self.get_object()
        
        # Проверяем, является ли текущий пользователь владельцем документа
        if document.owner != request.user:
            return Response(
                {"detail": "Только владелец документа может просматривать права доступа"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        access_rights = AccessRight.objects.filter(document=document)
        serializer = AccessRightSerializer(access_rights, many=True)
        
        return Response(serializer.data)
