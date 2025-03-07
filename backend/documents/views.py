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
