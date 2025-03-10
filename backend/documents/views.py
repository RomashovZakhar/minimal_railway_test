from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Document, AccessRight
from .serializers import DocumentSerializer, DocumentDetailSerializer, AccessRightSerializer
import json
import logging
import copy

# Настройка логгера
logger = logging.getLogger(__name__)

class DocumentViewSet(viewsets.ModelViewSet):
    """
    API endpoint для работы с документами
    """
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    
    def get_permissions(self):
        """
        Настраиваем разрешения в зависимости от действия
        Для всех действий требуется аутентификация
        """
        return [IsAuthenticated()]
    
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
    
    @action(detail=False, methods=['get'])
    def favorites(self, request):
        """
        Получение списка избранных документов пользователя
        """
        user = request.user
        
        # Получаем документы, отмеченные как избранные для текущего пользователя
        favorite_docs = Document.objects.filter(
            owner=user,
            is_favorite=True
        ).order_by('title')
        
        logger.info(f"Получены избранные документы для пользователя {user.id}, найдено: {favorite_docs.count()}")
        
        # Используем базовый сериализатор для списка документов
        serializer = self.get_serializer(favorite_docs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        """
        Добавление/удаление документа из избранного
        """
        document = self.get_object()
        document.is_favorite = not document.is_favorite
        document.save()
        
        # Логируем действие
        action_type = "добавлен в избранное" if document.is_favorite else "удален из избранного"
        logger.info(f"Документ {document.id} {action_type} пользователем {request.user.id}")
        
        serializer = self.get_serializer(document)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Поиск документов по названию
        """
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        
        # Поиск документов по названию
        user = request.user
        found_docs = Document.objects.filter(
            Q(owner=user) | Q(access_rights__user=user),
            title__icontains=query
        ).distinct().order_by('title')
        
        logger.info(f"Поиск документов по запросу '{query}', найдено: {found_docs.count()}")
        
        serializer = self.get_serializer(found_docs, many=True)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        """
        Полностью переопределяем метод создания документа для правильной обработки контента
        """
        logger.info("Создание нового документа...")
        
        # Получаем данные из запроса
        data = copy.deepcopy(request.data)
        
        # Логируем информацию о запросе на создание
        if 'content' in data:
            content_data = data['content']
            logger.info(f"content в запросе на создание: тип {type(content_data)}, пустой: {not bool(content_data)}")
            
            if isinstance(content_data, dict):
                logger.info(f"Ключи в content при создании: {', '.join(content_data.keys())}")
                if 'blocks' in content_data:
                    blocks = content_data.get('blocks', [])
                    logger.info(f"Блоков в запросе: {len(blocks)}")
        else:
            logger.warning("В запросе нет поля content")
        
        # Проверяем, является ли документ корневым
        is_root = data.get('is_root', False)
        if is_root:
            # Проверяем, существует ли уже корневой документ
            existing_root = Document.objects.filter(owner=request.user, is_root=True).first()
            if existing_root:
                # Если уже есть корневой документ, отменяем флаг is_root
                data['is_root'] = False
                logger.info(f"Попытка создать второй корневой документ для пользователя {request.user.id}: отменено")
        
        # Обрабатываем документы верхнего уровня
        parent = data.get('parent', None)
        if parent is None and not is_root:
            # Проверяем, есть ли уже корневой документ
            existing_root = Document.objects.filter(owner=request.user, is_root=True).first()
            if not existing_root:
                # Если нет явного корневого документа, проверяем документы верхнего уровня
                root_docs = Document.objects.filter(owner=request.user, parent=None)
                if not root_docs.exists():
                    # Если нет других документов верхнего уровня, помечаем этот как корневой
                    data['is_root'] = True
                    logger.info(f"Автоматически установлен флаг is_root=True для документа пользователя {request.user.id}")
        
        # Извлекаем content для ручного сохранения
        content = None
        if 'content' in data:
            content = data['content']
            # Проверяем формат контента
            if isinstance(content, str):
                try:
                    content = json.loads(content)
                    logger.info("Преобразовали строку JSON в объект")
                except json.JSONDecodeError as e:
                    logger.error(f"Ошибка декодирования JSON: {e}")
        
        # Создаем сериализатор для валидации данных
        serializer = self.get_serializer(data=data)
        
        if not serializer.is_valid():
            logger.error(f"Ошибка валидации: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Создаем новый документ с минимальными данными
        serializer.validated_data['owner'] = request.user
        
        # Сохраняем объект, исключая поле content
        if 'content' in serializer.validated_data:
            # Временно убираем content, чтобы сохранить его отдельно
            del serializer.validated_data['content']
        
        # Создаем документ с базовыми полями
        document = Document.objects.create(**serializer.validated_data)
        logger.info(f"Создан документ ID: {document.id}")
        
        # Теперь напрямую сохраняем content
        if content is not None:
            document.content = content
            document.save(update_fields=['content'])
            logger.info(f"Напрямую сохранили content для документа ID: {document.id}")
            
            # Проверяем результат
            saved_document = Document.objects.get(id=document.id)
            logger.info(f"Content после прямого сохранения: тип {type(saved_document.content)}, пустой: {not bool(saved_document.content)}")
            
            if isinstance(saved_document.content, dict):
                logger.info(f"Ключи в content: {', '.join(saved_document.content.keys())}")
                if 'blocks' in saved_document.content:
                    blocks = saved_document.content.get('blocks', [])
                    logger.info(f"Блоков после сохранения: {len(blocks)}")
        
        # Возвращаем ответ с созданным документом
        serializer = self.get_serializer(document)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """
        Переопределяем метод update для правильного сохранения content
        """
        logger.info(f"UPDATE запрос для документа ID: {kwargs.get('pk')}")
        
        # Создаем глубокую копию данных запроса
        mutable_data = copy.deepcopy(request.data)
        
        # Проверяем наличие контента в запросе
        if 'content' in mutable_data:
            content_data = mutable_data['content']
            logger.info(f"Тип content в запросе: {type(content_data)}")
            
            # Проверка и обработка content
            if isinstance(content_data, str):
                try:
                    content_data = json.loads(content_data)
                    mutable_data['content'] = content_data
                    logger.info("Преобразовали строку JSON в объект")
                except json.JSONDecodeError as e:
                    logger.error(f"Ошибка декодирования JSON: {e}")
            
            # Если content - словарь, логируем его ключи
            if isinstance(content_data, dict):
                logger.info(f"Ключи в content: {', '.join(content_data.keys())}")
                
                if 'blocks' in content_data:
                    blocks = content_data.get('blocks', [])
                    logger.info(f"Найдено {len(blocks)} блоков в словаре content")
        
        # Получаем объект документа
        instance = self.get_object()
        
        # Проверка текущего содержимого
        logger.info(f"Текущий content: тип {type(instance.content)}, пустой: {not bool(instance.content)}")
        
        # Создаем сериализатор с нашими данными
        serializer = self.get_serializer(instance, data=mutable_data, partial=True)
        
        if serializer.is_valid():
            # Перед сохранением явно устанавливаем content, если он есть в запросе
            if 'content' in mutable_data and isinstance(mutable_data['content'], dict):
                # Экстренное исправление: сохраняем content напрямую, минуя сериализатор
                instance.content = mutable_data['content']
                instance.save()
                logger.info(f"Сохранили content напрямую в модель. Размер: {len(json.dumps(instance.content))}")
            
            # Сохраняем остальные поля через сериализатор
            serializer.save()
            
            # Проверяем результат сохранения
            updated_instance = self.get_object()
            logger.info(f"После сохранения: content тип {type(updated_instance.content)}, пустой: {not bool(updated_instance.content)}")
            
            if isinstance(updated_instance.content, dict):
                logger.info(f"Ключи после сохранения: {', '.join(updated_instance.content.keys())}")
                
                if 'blocks' in updated_instance.content:
                    blocks = updated_instance.content.get('blocks', [])
                    logger.info(f"Блоков после сохранения: {len(blocks)}")
            
            return Response(serializer.data)
        
        logger.error(f"Ошибка валидации: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
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
