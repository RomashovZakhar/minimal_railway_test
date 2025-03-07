import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Document, DocumentHistory
from django.contrib.auth import get_user_model

User = get_user_model()

class DocumentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.document_id = self.scope['url_route']['kwargs']['document_id']
        self.room_group_name = f'document_{self.document_id}'
        
        # Проверка доступа пользователя к документу
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close()
            return
            
        has_access = await self.has_access_to_document(user.id, self.document_id)
        if not has_access:
            await self.close()
            return
            
        # Присоединение к группе документа
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Отправляем информацию о новом пользователе
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user_id': user.id,
                'username': user.username,
            }
        )
    
    async def disconnect(self, close_code):
        # Покидаем группу документа
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    # Получение сообщения от клиента
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'document_update':
            # Обновление содержимого документа
            changes = data.get('changes')
            await self.save_document_changes(changes)
            
            # Отправка обновления всем участникам
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'document_update',
                    'user_id': self.scope['user'].id,
                    'username': self.scope['user'].username,
                    'changes': changes,
                }
            )
    
    # Обработчик для обновления документа
    async def document_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'document_update',
            'user_id': event['user_id'],
            'username': event['username'],
            'changes': event['changes'],
        }))
    
    # Обработчик для присоединения пользователя
    async def user_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'user_id': event['user_id'],
            'username': event['username'],
        }))
    
    # Вспомогательные методы для работы с базой данных
    @database_sync_to_async
    def has_access_to_document(self, user_id, document_id):
        """Проверяет, имеет ли пользователь доступ к документу"""
        try:
            document = Document.objects.get(id=document_id)
            user = User.objects.get(id=user_id)
            
            # Проверка на владельца документа
            if document.owner_id == user_id:
                return True
                
            # Проверка на доступ через права доступа
            return document.access_rights.filter(user=user).exists()
        except (Document.DoesNotExist, User.DoesNotExist):
            return False
    
    @database_sync_to_async
    def save_document_changes(self, changes):
        """Сохраняет изменения документа и историю изменений"""
        try:
            document = Document.objects.get(id=self.document_id)
            user = User.objects.get(id=self.scope['user'].id)
            
            # Применяем изменения к содержимому документа
            # Здесь будет логика применения патчей или прямого обновления
            # В простейшем случае просто заменяем содержимое
            document.content = changes.get('content', document.content)
            document.save()
            
            # Сохраняем историю изменений
            DocumentHistory.objects.create(
                document=document,
                user=user,
                changes=changes
            )
            
            return True
        except (Document.DoesNotExist, User.DoesNotExist):
            return False 