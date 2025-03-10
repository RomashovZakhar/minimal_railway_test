import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Document, DocumentHistory
from django.contrib.auth import get_user_model
# Удаляем неправильный импорт
# from django.http.request import parse_cookie
from django.conf import settings
from django.contrib.sessions.models import Session
from django.utils import timezone

# Функция для парсинга cookie без использования parse_cookie
def parse_cookies(cookie_string):
    if not cookie_string:
        return {}
    cookies = {}
    for cookie in cookie_string.split('; '):
        if '=' in cookie:
            key, value = cookie.split('=', 1)
            cookies[key] = value
    return cookies

# Настраиваем логирование
logger = logging.getLogger(__name__)

User = get_user_model()

class DocumentConsumer(AsyncWebsocketConsumer):
    """
    Простой WebSocket-потребитель для документов
    """
    
    async def connect(self):
        """
        Обработка подключения клиента
        """
        try:
            # Получаем document_id из URL
            self.document_id = self.scope['url_route']['kwargs']['document_id']
            self.room_group_name = f'document_{self.document_id}'
            
            logger.info(f"[WebSocket] Попытка подключения к документу {self.document_id}")
            logger.info(f"[WebSocket] URL path: {self.scope.get('path', 'Не указан')}")
            logger.info(f"[WebSocket] Параметры URL: {self.scope.get('url_route', {}).get('kwargs', 'Не указаны')}")
            
            # Присоединяемся к группе документа
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            # Принимаем соединение
            await self.accept()
            
            logger.info(f"[WebSocket] Соединение принято для документа {self.document_id}")
            
            # Отправляем сообщение клиенту о успешном подключении
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': 'Подключение установлено',
                'document_id': self.document_id
            }))
        except Exception as e:
            logger.error(f"[WebSocket] Ошибка при подключении: {str(e)}")
            # Если произошла ошибка, закрываем соединение
            if hasattr(self, 'channel_name'):
                await self.close(code=4000)
    
    async def disconnect(self, close_code):
        """
        Обработка отключения клиента
        """
        try:
            logger.info(f"[WebSocket] Отключение от документа {self.document_id} с кодом {close_code}")
            
            # Покидаем группу
            if hasattr(self, 'room_group_name') and hasattr(self, 'channel_name'):
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
        except Exception as e:
            logger.error(f"[WebSocket] Ошибка при отключении: {str(e)}")
    
    async def receive(self, text_data):
        """
        Получение сообщения от клиента
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            logger.info(f"[WebSocket] Получено сообщение типа {message_type} для документа {self.document_id}")
            
            # Обрабатываем разные типы сообщений от клиента
            if message_type == 'document_update':
                content = data.get('content')
                sender_id = data.get('sender_id')
                user_id = data.get('user_id')
                username = data.get('username', 'Пользователь')
                
                logger.info(f"[WebSocket] Обновление документа {self.document_id} от пользователя {username}")
                
                # Отправляем всем в группу
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'document_update',
                        'user_id': user_id,
                        'username': username,
                        'content': content,
                        'sender_id': sender_id
                    }
                )
                
            elif message_type == 'cursor_connect':
                user_id = data.get('user_id')
                username = data.get('username', 'Пользователь')
                cursor_id = data.get('cursor_id')
                color = data.get('color')
                
                logger.info(f"[WebSocket] Подключение курсора пользователя {username} к документу {self.document_id}")
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'cursor_connected',
                        'user_id': user_id,
                        'username': username,
                        'cursor_id': cursor_id,
                        'color': color
                    }
                )
        
        except json.JSONDecodeError:
            logger.error("[WebSocket] Ошибка декодирования JSON")
        except Exception as e:
            logger.error(f"[WebSocket] Необработанная ошибка: {str(e)}")
    
    # Обработчики сообщений для группы
    
    async def document_update(self, event):
        """
        Отправка обновления документа клиенту
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'document_update',
                'user_id': event['user_id'],
                'username': event['username'],
                'content': event['content'],
                'sender_id': event['sender_id']
            }))
            logger.info(f"[WebSocket] Отправлено обновление документа {self.document_id} клиенту")
        except Exception as e:
            logger.error(f"[WebSocket] Ошибка при отправке обновления: {str(e)}")
    
    async def cursor_connected(self, event):
        """
        Отправка информации о подключении курсора
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'cursor_connected',
                'user_id': event['user_id'],
                'username': event['username'],
                'cursor_id': event['cursor_id'],
                'color': event['color']
            }))
            logger.info(f"[WebSocket] Отправлена информация о курсоре пользователя {event['username']}")
        except Exception as e:
            logger.error(f"[WebSocket] Ошибка при отправке информации о курсоре: {str(e)}")
    
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
        except (Document.DoesNotExist, User.DoesNotExist) as e:
            logger.error(f"Ошибка проверки доступа: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Непредвиденная ошибка при проверке доступа: {str(e)}")
            return False
    
    @database_sync_to_async
    def save_document_content(self, content):
        """Сохраняет содержимое документа и историю изменений"""
        try:
            document = Document.objects.get(id=self.document_id)
            user = User.objects.get(id=self.scope['user'].id)
            
            # Сохраняем предыдущее содержимое для истории
            previous_content = document.content
            
            # Обновляем содержимое документа
            document.content = content
            document.save()
            
            # Создаем запись в истории изменений
            DocumentHistory.objects.create(
                document=document,
                user=user,
                changes={
                    'content': content,
                    'user_id': user.id,
                    'username': user.username,
                }
            )
            
            logger.info(f"Документ {self.document_id} успешно обновлен пользователем {user.username}")
            return True
        except Exception as e:
            logger.error(f"Ошибка при сохранении документа {self.document_id}: {str(e)}")
            return False
    
    @database_sync_to_async
    def get_user_from_session(self, scope):
        """Получает пользователя из сессии"""
        try:
            # Получаем cookies из scope
            cookie_string = scope.get('headers', {}).get('cookie', b'').decode('utf-8')
            cookies = parse_cookies(cookie_string)
            
            # Получаем session_key
            session_key = cookies.get(settings.SESSION_COOKIE_NAME)
            if not session_key:
                logger.warning("Сессионная куки не найдена")
                return None
                
            # Находим сессию
            session = Session.objects.filter(
                session_key=session_key,
                expire_date__gt=timezone.now()
            ).first()
            
            if not session:
                logger.warning("Сессия не найдена или истекла")
                return None
                
            # Получаем user_id из сессии
            session_data = session.get_decoded()
            user_id = session_data.get('_auth_user_id')
            
            if not user_id:
                logger.warning("ID пользователя не найден в сессии")
                return None
                
            # Находим пользователя
            user = User.objects.get(id=user_id)
            return user
        except Exception as e:
            logger.error(f"Ошибка при получении пользователя из сессии: {str(e)}")
            return None 