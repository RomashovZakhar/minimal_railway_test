"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { useAuth } from "@/components/auth"
import { nanoid } from "nanoid"

// Типы для документа
interface Document {
  id: string;
  title: string;
  content: any;
  parent: string | null;
  is_favorite?: boolean;
}

interface DocumentEditorProps {
  document: Document;
  onChange: (document: Document) => void;
  titleInputRef?: React.RefObject<HTMLInputElement | null>;
}

// Интерфейс для курсора другого пользователя
interface RemoteCursor {
  id: string;
  username: string;
  color: string;
  position: {
    blockIndex: number;
    offset: number;
  } | null;
  timestamp: number;
}

// Добавляем интерфейсы для типизации
interface EditorApi {
  blocks: {
    insert: (type: string, data?: any) => void;
  };
  save: () => Promise<any>;
}

interface WebSocketError extends Event {
  error?: Error;
  message?: string;
}

// Кастомный блок для вложенного документа
const NestedDocumentTool = {
  class: class {
    api: any;
    data: {
      id: string;
      title: string;
    };
    block: HTMLElement;
    container: HTMLElement;
    pendingCreation: boolean;
    isNewBlock: boolean;
    
    static get toolbox() {
      return {
        title: 'Вложенный документ',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5Z" stroke="currentColor" stroke-width="2"/><path d="M7 7H17" stroke="currentColor" stroke-width="2"/><path d="M7 12H17" stroke="currentColor" stroke-width="2"/><path d="M7 17H13" stroke="currentColor" stroke-width="2"/></svg>'
      };
    }
    
    constructor({ data, api, block }: { data: any, api: any, block: HTMLElement }) {
      this.api = api;
      this.data = data || { id: '', title: 'Новый документ' };
      this.block = block;
      this.container = document.createElement('div');
      this.container.classList.add('nested-document-block');
      this.pendingCreation = false;
      
      // Определяем, является ли блок новым или существующим
      // Новый блок - созданный через тулбар (без ID)
      // Существующий блок - загруженный из сохраненного документа (с или без ID)
      this.isNewBlock = !this.data.id && !block.innerHTML;
      
      console.log('Создан блок вложенного документа:', {
        isNewBlock: this.isNewBlock, 
        hasId: !!this.data.id, 
        title: this.data.title
      });
    }
    
    // Отображает блок в редакторе
    render() {
      // Если это существующий документ с ID, просто отображаем ссылку
      if (this.data.id) {
        this.renderExistingDocument();
        return this.container;
      }
      
      // Если это новый блок (созданный через тулбар), то создаем новый документ
      if (this.isNewBlock) {
        // Сразу отображаем состояние загрузки
        this.renderLoadingState();
        
        // Начинаем создание с небольшой задержкой
        setTimeout(() => {
          this.createDocument().catch(error => {
            console.error('Ошибка при создании документа:', error);
            this.renderErrorState(error.message || 'Не удалось создать документ');
          });
        }, 100);
      } else {
        // Если это существующий блок без ID (например, загруженный из сохраненного документа),
        // то отображаем кнопку для создания документа
        this.renderCreateButton();
      }
      
      return this.container;
    }
    
    // Отображает ссылку на существующий документ
    renderExistingDocument() {
      // Если у нас есть id документа, загружаем актуальные данные
      if (this.data.id) {
        // Загружаем актуальные данные о документе с сервера
        this.fetchDocumentDetails(this.data.id);
      } else {
        // Если ID нет, просто отображаем с имеющимися данными
        this.renderDocumentLink();
      }
      
      return this.container;
    }
    
    // Загружает актуальные данные о документе
    async fetchDocumentDetails(documentId: string) {
      try {
        console.log(`Загрузка актуальных данных для документа: ${documentId}`);
        const response = await api.get(`/documents/${documentId}/`);
        
        if (response.data && response.data.title) {
          console.log(`Получены данные, текущее название: ${this.data.title}, актуальное название: ${response.data.title}`);
          
          // Обновляем данные только если название изменилось
          if (this.data.title !== response.data.title) {
            this.data.title = response.data.title;
            console.log(`Название обновлено на: ${this.data.title}`);
            
            // Обновляем данные блока в EditorJS
            try {
              if (this.api && typeof this.api.blocks?.getCurrentBlockIndex === 'function') {
                const blockIndex = this.api.blocks.getCurrentBlockIndex();
                if (typeof blockIndex === 'number') {
                  await this.api.blocks.update(blockIndex, this.data);
                  console.log(`Блок ${blockIndex} обновлен с новым названием`);
                }
              }
            } catch (e) {
              console.error('Ошибка при обновлении блока:', e);
            }
          }
        }
        
        // Отображаем ссылку с актуальными данными
        this.renderDocumentLink();
      } catch (error) {
        console.error('Ошибка при загрузке документа:', error);
        // В случае ошибки просто отображаем с имеющимися данными
        this.renderDocumentLink();
      }
    }
    
    // Непосредственно отображает ссылку
    renderDocumentLink() {
      // Безопасно экранируем title
      const safeTitle = (this.data.title || 'Документ')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      // Создаем контейнер для ссылки в стиле Notion
      const linkContainer = document.createElement('div');
      linkContainer.className = 'py-1 px-2 -mx-2 my-0.5 inline-block rounded hover:bg-muted/80 transition-colors cursor-pointer';
      
      // Текст ссылки в стиле Notion с подчеркиванием
      const textSpan = document.createElement('span');
      textSpan.className = 'font-medium text-sm text-foreground border-b border-muted-foreground/40';
      textSpan.textContent = safeTitle;
      
      // Добавляем текст в контейнер
      linkContainer.appendChild(textSpan);
      
      // Добавляем обработчик клика
      linkContainer.addEventListener('click', () => {
        window.location.href = `/documents/${this.data.id}`;
      });
      
      // Очищаем и добавляем новое содержимое
      this.container.innerHTML = '';
      this.container.appendChild(linkContainer);
    }
    
    // Отображает кнопку для создания документа
    renderCreateButton() {
      // Создаем контейнер в стиле Notion
      const container = document.createElement('div');
      container.className = 'py-1 my-1';
      
      // Создаем интерактивный элемент в стиле Notion
      const createLink = document.createElement('div');
      createLink.className = 'inline-flex items-center py-1 px-2 -mx-2 rounded hover:bg-muted/80 transition-colors cursor-pointer text-blue-600 hover:text-blue-700';
      
      // Иконка "плюс" в том же стиле
      const plusIcon = document.createElement('span');
      plusIcon.className = 'mr-1 h-4 w-4';
      plusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4V20M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      
      // Текст ссылки
      const linkText = document.createElement('span');
      linkText.className = 'font-medium text-sm';
      linkText.textContent = 'Создать документ';
      
      // Собираем элементы
      createLink.appendChild(plusIcon);
      createLink.appendChild(linkText);
      container.appendChild(createLink);
      
      // Добавляем обработчик нажатия
      createLink.addEventListener('click', async () => {
        // Показываем загрузку
        this.renderLoadingState();
        
        try {
          await this.createDocument();
        } catch (error) {
          // В случае ошибки возвращаем кнопку создания
          this.renderCreateButton();
        }
      });
      
      // Очищаем и добавляем новое содержимое
      this.container.innerHTML = '';
      this.container.appendChild(container);
    }
    
    // Отображает состояние загрузки
    renderLoadingState() {
      // Создаем контейнер в стиле Notion
      const loadingContainer = document.createElement('div');
      loadingContainer.className = 'py-1 px-2 -mx-2 my-0.5 inline-block rounded bg-muted/30';
      
      // Текст загрузки
      const textSpan = document.createElement('span');
      textSpan.className = 'font-medium text-sm text-muted-foreground';
      textSpan.textContent = 'Создание документа';
      
      // Добавляем анимацию точек
      const dotsSpan = document.createElement('span');
      dotsSpan.className = 'inline-flex ml-1';
      dotsSpan.innerHTML = '<span class="animate-pulse">.</span><span class="animate-pulse delay-100">.</span><span class="animate-pulse delay-200">.</span>';
      
      // Добавляем элементы в контейнер
      textSpan.appendChild(dotsSpan);
      loadingContainer.appendChild(textSpan);
      
      // Очищаем и добавляем новое содержимое
      this.container.innerHTML = '';
      this.container.appendChild(loadingContainer);
    }
    
    // Создает новый вложенный документ
    async createDocument() {
      if (this.pendingCreation) return; // Предотвращаем двойное создание
      
      this.pendingCreation = true;
      
      try {
        // Сначала отображаем состояние загрузки
        this.renderLoadingState();
        
        // Получаем ID текущего документа
        const currentPathParts = window.location.pathname.split('/');
        const currentDocumentId = currentPathParts[currentPathParts.length - 1];
        
        if (!currentDocumentId) {
          throw new Error('Не удалось определить ID текущего документа');
        }
        
        // Шаг 1: Получаем текущий контент родительского документа перед созданием нового
        const parentResponse = await api.get(`/documents/${currentDocumentId}/`);
        const parentDoc = parentResponse.data;
        
        if (!parentDoc.content) {
          parentDoc.content = {
            time: new Date().getTime(),
            version: "2.27.0",
            blocks: []
          };
        }
        
        if (!Array.isArray(parentDoc.content.blocks)) {
          parentDoc.content.blocks = [];
        }
        
        console.log('Создание вложенного документа...');
        
        // Шаг 2: Создаем новый документ
        const response = await api.post('/documents/', {
          title: 'Новый документ',
          content: {
            time: new Date().getTime(),
            version: "2.27.0",
            blocks: []
          },
          parent: currentDocumentId
        });
        
        if (!response.data || !response.data.id) {
          throw new Error('Сервер вернул некорректный ответ');
        }
        
        const newDocumentId = response.data.id;
        const newTitle = response.data.title || 'Новый документ';
        
        // Обновляем данные блока в локальном представлении
        this.data = {
          id: newDocumentId,
          title: newTitle
        };
        
        // Обновляем отображение блока - НЕ вызываем здесь renderExistingDocument,
        // так как он будет вызван позже при редиректе
        
        // Шаг 3: Создаем новый блок в родительском документе
        // Вместо обновления существующего блока, просто добавляем новый
        if (typeof this.api.blocks.getCurrentBlockIndex() === 'number') {
          // Получаем текущий индекс блока для замены
          const blockIndex = this.api.blocks.getCurrentBlockIndex();
          
          // Добавляем новый блок вместо текущего
          const updatedBlock = {
            type: 'nestedDocument',
            data: {
              id: newDocumentId,
              title: newTitle
            }
          };
          
          // Обновляем блоки в родительском документе
          parentDoc.content.blocks[blockIndex] = updatedBlock;
          
          // Шаг 4: Сохраняем обновленный родительский документ
          const saveResponse = await api.put(`/documents/${currentDocumentId}/`, {
            content: parentDoc.content,
            title: parentDoc.title,
            parent: parentDoc.parent
          });
          
          console.log('Родительский документ успешно обновлен с ссылкой на новый документ', saveResponse.data);
          
          // Добавляем задержку перед редиректом, чтобы убедиться что сохранение завершено
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.warn('Не удалось получить индекс текущего блока');
        }
        
        // Шаг 5: Редирект на новый документ
        window.location.href = `/documents/${newDocumentId}`;
      } catch (error: any) {
        this.pendingCreation = false;
        console.error('Ошибка при создании документа:', error);
        this.renderErrorState(error.message || 'Не удалось создать документ');
        throw error; // Пробрасываем ошибку дальше
      }
    }
    
    // Отображает состояние ошибки
    renderErrorState(errorMessage: string) {
      // Создаем элементы вручную
      const errorContainer = document.createElement('div');
      errorContainer.className = 'flex items-center p-4 my-2 bg-red-50 rounded-lg border border-red-200 text-red-700';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'flex-1';
      
      const titleElement = document.createElement('h4');
      titleElement.className = 'font-medium';
      titleElement.textContent = 'Ошибка при создании документа';
      
      const descElement = document.createElement('p');
      descElement.className = 'text-sm';
      descElement.textContent = errorMessage;
      
      contentDiv.appendChild(titleElement);
      contentDiv.appendChild(descElement);
      errorContainer.appendChild(contentDiv);
      
      // Очищаем и добавляем новое содержимое
      this.container.innerHTML = '';
      this.container.appendChild(errorContainer);
    }
    
    // Метод сохранения данных блока
    save() {
      return this.data;
    }
  }
};

// Генерация случайного цвета для курсора пользователя
function getRandomColor() {
  const colors = [
    '#FF6B6B', // красный
    '#4ECDC4', // бирюзовый
    '#FFE66D', // желтый
    '#6A0572', // фиолетовый
    '#1A936F', // зеленый
    '#FF9F1C', // оранжевый
    '#7D5BA6', // пурпурный
    '#3185FC', // синий
    '#FF5964', // коралловый
    '#25A18E', // морской
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function DocumentEditor({ document, onChange, titleInputRef }: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title)
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<any>(null)
  const cursorIdRef = useRef(nanoid())
  const cursorPositionRef = useRef<{blockIndex: number, offset: number} | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const [editor, setEditor] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const cursorUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDocumentContent = useRef<any>(document.content);

  // Команды редактора
  const editorCommands = [
    {
      name: "Заголовок 2-го уровня",
      icon: "H2",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("header", { level: 2, text: "" })
        }
      }
    },
    {
      name: "Заголовок 3-го уровня",
      icon: "H3",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("header", { level: 3, text: "" })
        }
      }
    },
    {
      name: "Заголовок 4-го уровня",
      icon: "H4",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("header", { level: 4, text: "" })
        }
      }
    },
    {
      name: "Нумерованный список",
      icon: "1.",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("list", { style: "ordered" })
        }
      }
    },
    {
      name: "Маркированный список",
      icon: "•",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("list", { style: "unordered" })
        }
      }
    },
    {
      name: "Чекбокс (задача)",
      icon: "☐",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("checklist")
        }
      }
    },
    {
      name: "Вставка изображения",
      icon: "🖼️",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("image")
        }
      }
    },
    {
      name: "Новый документ",
      icon: "📄",
      action: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.blocks.insert("nestedDocument")
        }
      }
    }
  ]

  // WebSocket соединение
  useEffect(() => {
    // Проверяем необходимые условия для WebSocket
    if (typeof window === 'undefined' || !document.id || !user) {
      console.log('Пропускаем инициализацию WebSocket: не на клиенте или нет данных');
      return;
    }

    // Проверяем поддержку WebSocket в браузере
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket не поддерживается в этом браузере');
      return;
    }

    // Отключаем WebSocket для разработки, если нет серверной поддержки
    // Включите эту опцию, если у вас нет поддержки WebSocket на сервере
    const DISABLE_WEBSOCKET = true;
    if (DISABLE_WEBSOCKET) {
      console.log('WebSocket отключен по настройке DISABLE_WEBSOCKET');
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    // Используем безопасный конструктор URL с проверкой
    let wsUrl;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws/documents/${document.id}/`;
      console.log('Создан URL для WebSocket:', wsUrl);
    } catch (err) {
      console.error('Ошибка при создании URL для WebSocket:', err);
      return;
    }

    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.warn(`Превышено максимальное количество попыток подключения к WebSocket (${maxReconnectAttempts})`);
        return;
      }

      try {
        console.log(`Попытка подключения к WebSocket (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
        
        // Создаем WebSocket с таймаутом
        ws = new WebSocket(wsUrl);
    wsRef.current = ws;

        // Таймаут для соединения
        const connectionTimeout = setTimeout(() => {
          if (ws && ws.readyState !== WebSocket.OPEN) {
            console.warn('Таймаут соединения WebSocket');
            ws.close();
          }
        }, 5000);

    ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket подключение установлено');
          reconnectAttempts = 0; // Сбрасываем счетчик при успешном подключении
          
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
      ws.send(JSON.stringify({
        type: 'cursor_connect',
        user_id: user.id,
        username: user.username || 'Пользователь',
        cursor_id: cursorIdRef.current,
                color: getRandomColor()
      }));
              console.log('Отправлено сообщение о подключении');
            } catch (sendErr) {
              console.error('Ошибка при отправке сообщения о подключении:', sendErr);
            }
          }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
            console.log('Получено сообщение WebSocket:', data.type);
            
            if (data.type === 'document_update' && 
                data.sender_id !== cursorIdRef.current && 
                editorInstanceRef.current) {
              try {
                // Используем метод render с обработкой ошибок
                if (typeof editorInstanceRef.current.render === 'function') {
                  const renderResult = editorInstanceRef.current.render(data.content);
                  
                  // Проверяем, возвращает ли render промис
                  if (renderResult && typeof renderResult.catch === 'function') {
                    renderResult.catch((err: Error) => {
                      console.error('Ошибка при рендеринге данных из WebSocket:', err.message || err);
                    });
                  }
                }
              } catch (renderErr) {
                console.error('Ошибка при вызове render:', renderErr);
              }
            }
          } catch (parseErr) {
            console.warn('Ошибка при обработке сообщения WebSocket:', parseErr);
          }
        };

        ws.onerror = (error: Event) => {
          clearTimeout(connectionTimeout);
          
          // Безопасно логируем ошибку WebSocket
          console.warn('WebSocket ошибка:', {
            type: error.type,
            timeStamp: error.timeStamp
          });
        };

        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          
          console.log('WebSocket соединение закрыто:', 
            event.code, 
            event.reason || 'Причина не указана',
            event.wasClean ? '(корректно)' : '(некорректно)'
          );
          
          wsRef.current = null;
          
          // Переподключаемся только если соединение закрылось неожиданно
          // и мы не превысили лимит попыток
          if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 16000);
            console.log(`Переподключение через ${delay/1000} секунд...`);
            
            setTimeout(connectWebSocket, delay);
          }
        };
      } catch (err) {
        console.warn('Ошибка при создании WebSocket:', err);
        wsRef.current = null;
        
        // Пробуем переподключиться с задержкой
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 16000);
          setTimeout(connectWebSocket, delay);
        }
      }
    };

    // Инициируем первое подключение с небольшой задержкой
    const initTimeout = setTimeout(() => {
      connectWebSocket();
    }, 500);

    return () => {
      clearTimeout(initTimeout);
      
      if (ws) {
        try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, 'Компонент размонтирован');
          }
        } catch (err) {
          console.warn('Ошибка при закрытии WebSocket:', err);
        }
      }
    };
  }, [document.id, user]);

  // Отправка позиции курсора
  const sendCursorPosition = (position: {blockIndex: number, offset: number} | null) => {
    // Проверяем доступность WebSocket перед отправкой
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    try {
    // Сохраняем текущую позицию
    cursorPositionRef.current = position;
    
    // Отправляем данные о позиции
    wsRef.current.send(JSON.stringify({
      type: 'cursor_update',
      cursor_id: cursorIdRef.current,
      position,
      username: user?.username || 'Пользователь'
    }));
    } catch (err) {
      console.warn('Ошибка при отправке позиции курсора:', err);
    }
  };

  // Первый render редактора (только один раз)
  const isFirstRender = useRef(true);
  
  // Флаг для определения, происходит ли сохранение
  const isSavingRef = useRef(false);
  
  // Последнее состояние контента для сравнения
  const lastContentRef = useRef<any>(null);
  
  // Получаем кэшированный контент при инициализации
  const getCachedContent = useCallback((documentId: string) => {
    try {
      const cachedData = localStorage.getItem(`document_cache_${documentId}`);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const timestamp = parsed.timestamp || 0;
        const content = parsed.content;
        
        // Проверяем, не устарел ли кэш (24 часа)
        const cacheLifetime = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
        if (Date.now() - timestamp < cacheLifetime) {
          console.log('Найден действительный кэшированный контент:', content);
          return content;
        } else {
          console.log('Кэшированный контент устарел, удаляем');
          localStorage.removeItem(`document_cache_${documentId}`);
        }
      }
    } catch (err) {
      console.warn('Ошибка при чтении кэшированного контента:', err);
    }
    return null;
  }, []);

  // Сохраняем контент в локальное хранилище
  const updateContentCache = useCallback((documentId: string, content: any) => {
    try {
      localStorage.setItem(`document_cache_${documentId}`, JSON.stringify({
        content,
        timestamp: Date.now()
      }));
      console.log('Контент сохранен в кэш');
    } catch (err) {
      console.warn('Ошибка при сохранении контента в кэш:', err);
    }
  }, []);

  // Добавляем эффект загрузки кэшированного контента при монтировании
  useEffect(() => {
    if (document.id) {
      const cachedContent = getCachedContent(document.id);
      if (cachedContent && (!document.content || Object.keys(document.content).length === 0)) {
        console.log('Используем кэшированный контент вместо пустого контента с сервера');
        onChange({
          ...document,
          content: cachedContent
        });
      }
    }
  }, [document.id, document.content, getCachedContent, onChange]);

  // Модифицируем triggerAutosave для кэширования
  const triggerAutosave = useCallback((content: any) => {
    // Если уже идет сохранение, пропускаем
    if (isSavingRef.current) return;
    
    // Если контент не изменился, не сохраняем
    if (lastContentRef.current && 
        JSON.stringify(lastContentRef.current) === JSON.stringify(content)) {
      console.log('Содержимое не изменилось, пропускаем сохранение');
      return;
    }
    
    console.log('Контент изменился, планируем сохранение...');
    console.log('Новый контент:', content);
    
    // Сразу кэшируем контент локально для защиты от потери данных
    updateContentCache(document.id, content);
    
    // Очищаем предыдущий таймер, если он был
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Устанавливаем новый таймер для сохранения с большим дебаунсом
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Устанавливаем флаг сохранения
        isSavingRef.current = true;
        
        console.log('Сохраняем документ на сервере...');
        
        // Сохраняем текущее состояние контента
        lastContentRef.current = content;
        
        // Полные данные для обновления документа
        const documentData = {
          title,
          content,
          parent: document.parent,
          is_favorite: document.is_favorite || false
        };
        
        console.log('Отправляемые данные:', documentData);
        
        // Отправляем данные на сервер с полным URL
        const response = await api.put(`/documents/${document.id}/`, documentData);
        
        console.log('Ответ сервера:', response.data);
        console.log('Документ успешно сохранен');
        
        // Синхронизируем состояние документа с полученными данными
        if (response.data && typeof onChange === 'function') {
          onChange({
            ...document,
            content: response.data.content || content,
            title: response.data.title || title
          });
        }
        
        // Отправляем данные через WebSocket, если соединение активно
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'document_update',
            content,
            sender_id: cursorIdRef.current
          }));
        }
      } catch (error: any) {
        console.error('Ошибка при автосохранении:', error);
        console.error('Детали ошибки:', error.response?.data || error.message);
        
        // Повторная попытка сохранения через 5 секунд при ошибке
        setTimeout(() => {
          isSavingRef.current = false;
          triggerAutosave(content);
        }, 5000);
      } finally {
        // Снимаем флаг сохранения
        isSavingRef.current = false;
      }
    }, 3000); // Задержка в 3 секунды
  }, [document.id, document.parent, document.is_favorite, title, onChange, updateContentCache]);

  // Создаем экземпляр EditorJS
  useEffect(() => {
    // Для предотвращения ненужных пересозданий редактора
    if (!isFirstRender.current && editorInstanceRef.current) {
      // Если это не первый рендер и редактор уже существует, просто обновляем данные
      console.log("Пропускаем пересоздание редактора, так как он уже существует");
      return;
    }
    
    isFirstRender.current = false;
    
    // Динамический импорт EditorJS для клиентской стороны
    const initEditor = async () => {
      try {
        // Проверяем, что мы на клиенте и элемент существует
        if (typeof window === "undefined") {
          console.log("Не на клиенте, пропускаем инициализацию EditorJS");
          return;
        }
        
        // Проверяем наличие DOM элемента
        if (!editorRef.current) {
          console.log("DOM элемент для редактора не найден, пропускаем инициализацию");
          return;
        }

        console.log("Начинаем инициализацию редактора...");

        // Импортируем все необходимые модули
        const [
          EditorJSModule,
          HeaderModule,
          ListModule,
          ChecklistModule,
          ImageModule
        ] = await Promise.all([
          import('@editorjs/editorjs'),
          import('@editorjs/header'),
          import('@editorjs/list'),
          import('@editorjs/checklist'),
          import('@editorjs/image')
        ]);

        // Извлекаем классы из модулей
        const EditorJS = EditorJSModule.default;
        const Header = HeaderModule.default;
        const List = ListModule.default;
        const Checklist = ChecklistModule.default;
        const Image = ImageModule.default;

        // Если редактор уже существует, безопасно уничтожаем его
        if (editorInstanceRef.current) {
          try {
            console.log("Уничтожаем предыдущий экземпляр редактора...");
            
            // Безопасное уничтожение экземпляра
            if (typeof editorInstanceRef.current.destroy === 'function') {
              const destroyPromise = editorInstanceRef.current.destroy();
              if (destroyPromise && typeof destroyPromise.then === 'function') {
                await destroyPromise;
              }
            } else {
              console.log("Метод destroy не найден, очищаем ссылку напрямую");
            }
          } catch (destroyError) {
            console.error("Ошибка при уничтожении предыдущего экземпляра:", destroyError);
          }
          
          // В любом случае, сбрасываем ссылку
          editorInstanceRef.current = null;
        }

        console.log("Подготавливаем данные для редактора...");
        console.log("Исходные данные документа:", document.content);

        // Гарантируем, что у нас есть данные в правильном формате
        let editorData;
        
        // Проверяем наличие кэшированного контента
        const cachedContent = getCachedContent(document.id);
        
        // Функция для проверки валидности структуры данных
        const isValidEditorData = (data: any) => {
          return data && 
                 typeof data === 'object' && 
                 Array.isArray(data.blocks);
        };
        
        // Сначала пробуем использовать кэшированный контент
        if (cachedContent && isValidEditorData(cachedContent)) {
          console.log("Используем кэшированный контент");
          editorData = {
            time: cachedContent.time || new Date().getTime(),
            version: cachedContent.version || "2.27.0",
            blocks: cachedContent.blocks
          };
        }
        // Затем пытаемся использовать существующие данные
        else if (isValidEditorData(document.content)) {
          console.log("Найдены корректные данные в контенте документа");
          editorData = {
            time: document.content.time || new Date().getTime(),
            version: document.content.version || "2.27.0",
            blocks: document.content.blocks
          };
        } 
        // Если content - пустой объект, создаем базовую структуру
        else if (document.content && typeof document.content === 'object' && Object.keys(document.content).length === 0) {
          console.log("Контент - пустой объект, создаем базовую структуру");
          editorData = {
            time: new Date().getTime(),
            version: "2.27.0",
            blocks: []
          };
        } else if (typeof document.content === 'string') {
          // Пробуем распарсить JSON-строку
          try {
            console.log("Контент в виде строки, пробуем распарсить JSON");
            const parsedContent = JSON.parse(document.content);
            
            if (isValidEditorData(parsedContent)) {
              console.log("JSON успешно распарсен");
              editorData = {
                time: parsedContent.time || new Date().getTime(),
                version: parsedContent.version || "2.27.0",
                blocks: parsedContent.blocks
              };
            } else {
              console.log("Распарсенный JSON не содержит корректных данных");
              // Создаем базовый текстовый блок из строки
              editorData = {
                time: new Date().getTime(),
                version: "2.27.0",
                blocks: [
                  {
                    type: "paragraph",
                    data: {
                      text: typeof document.content === 'string' ? document.content : ""
                    }
                  }
                ]
              };
            }
          } catch (parseErr) {
            console.warn("Ошибка при парсинге JSON:", parseErr);
            // Создаем базовый текстовый блок из строки
            editorData = {
              time: new Date().getTime(),
              version: "2.27.0",
              blocks: [
                {
                  type: "paragraph",
                  data: {
                    text: typeof document.content === 'string' ? document.content : ""
                  }
                }
              ]
            };
          }
        } else if (document.content === null || document.content === undefined) {
          // Документ новый или без контента
          console.log("Документ без контента, создаем пустую структуру");
          editorData = {
            time: new Date().getTime(),
            version: "2.27.0",
            blocks: []
          };
        } else {
          // Непонятный формат данных
          console.log("Неизвестный формат данных, создаем пустую структуру");
          editorData = {
            time: new Date().getTime(),
            version: "2.27.0",
            blocks: []
          };
        }
        
        // Сохраняем подготовленные данные для автосохранения
        lastContentRef.current = editorData;
        
        // Обновляем кэш с подготовленными данными
        updateContentCache(document.id, editorData);
        
        console.log("Подготовленные данные для редактора:", editorData);

        // Создаем новый экземпляр
        console.log("Создаем экземпляр EditorJS...");
        const editor = new EditorJS({
          holder: editorRef.current,
          data: editorData,
          onReady: () => {
            console.log('Editor.js готов к работе');
            editorInstanceRef.current = editor;
          },
          onChange: function(api: any) {
            try {
              // Пропускаем автосохранение, если сейчас идет сохранение
              if (isSavingRef.current) return;
              
              // Используем безопасное сохранение с явным this
              editor.save().then((outputData: any) => {
                // Обновляем только состояние компонента без перерисовки редактора
                onChange({ ...document, content: outputData, title });
                
                // Запускаем автосохранение отдельно от обновления состояния
                triggerAutosave(outputData);
              }).catch((saveErr: Error) => {
                console.error('Ошибка при сохранении:', saveErr);
              });
            } catch (err) {
              console.error('Ошибка в onChange:', err);
            }
          },
          autofocus: true,
          placeholder: 'Нажмите "/" для вызова меню команд',
          tools: {
            header: {
              class: Header,
              inlineToolbar: true,
              shortcut: 'CMD+SHIFT+H',
              config: {
                placeholder: 'Введите заголовок',
                levels: [2, 3, 4],
                defaultLevel: 3
              }
            },
            list: {
              class: List,
              inlineToolbar: true,
              config: {
                defaultStyle: 'unordered'
              }
            },
            image: {
              class: Image,
              config: {
                endpoints: {
                  byFile: '/api/upload-image/'
                }
              }
            },
            nestedDocument: NestedDocumentTool 
          },
          i18n: {
            messages: {
              ui: {
                "blockTunes": {
                  "toggler": {
                    "Click to tune": "Нажмите, чтобы настроить",
                  }
                },
                "inlineToolbar": {
                  "converter": {
                    "Convert to": "Конвертировать в"
                  }
                },
                "toolbar": {
                  "toolbox": {
                    "Add": "Добавить"
                  }
                }
              },
              toolNames: {
                "Text": "Текст",
                "Heading": "Заголовок",
                "List": "Список",
                "Checklist": "Чек-лист",
                "Image": "Изображение",
                "Nested Document": "Вложенный документ"
              },
              tools: {
                "header": {
                  "Heading 2": "Заголовок 2-го уровня",
                  "Heading 3": "Заголовок 3-го уровня",
                  "Heading 4": "Заголовок 4-го уровня"
                },
                "list": {
                  "Unordered": "Маркированный список",
                  "Ordered": "Нумерованный список"
                }
              }
            }
          }
        });
        
        console.log("Экземпляр EditorJS создан");
      } catch (err) {
        console.error('Ошибка при инициализации EditorJS:', err);
      }
    };

    // Запускаем инициализацию с небольшой задержкой
    console.log("Установка таймера для инициализации EditorJS...");
    const timer = setTimeout(() => {
    initEditor();
    }, 300); // Увеличиваем задержку для надежности

    return () => {
      console.log("Очистка при размонтировании компонента DocumentEditor");
      clearTimeout(timer);
      
      if (editorInstanceRef.current) {
        try {
          // Проверяем, является ли destroy функцией
          if (typeof editorInstanceRef.current.destroy === 'function') {
            // Некоторые версии EditorJS могут не возвращать промис из destroy
            const destroyResult = editorInstanceRef.current.destroy();
            
            // Обрабатываем случай, если destroy возвращает промис
            if (destroyResult && typeof destroyResult.then === 'function') {
              destroyResult.then(() => {
                console.log('Редактор успешно уничтожен');
              }).catch((err: Error) => {
                console.error('Ошибка при уничтожении редактора:', err.message || 'Неизвестная ошибка');
              });
            }
          } else {
            console.log('Метод destroy не найден, используем альтернативную очистку');
          }
        } catch (err) {
          console.error('Ошибка при попытке уничтожить редактор:', err);
        } finally {
        editorInstanceRef.current = null;
        }
      }
    };
  }, [document.id]); // Оставляем только зависимость от ID документа

  // Очистка таймера автосохранения при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Обновляем заголовок документа
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    onChange({ ...document, title: newTitle });
  };

  // Сохранение перед уходом
  useEffect(() => {
    // Функция для сохранения данных перед уходом со страницы
    const saveBeforeLeavingPage = async (event: BeforeUnloadEvent) => {
      try {
        // Если редактор существует, сохраняем его содержимое
        if (editorInstanceRef.current) {
          try {
            // Синхронное блокирующее сохранение
            const contentToSave = await editorInstanceRef.current.save();
            
            // Если контент изменился с момента последнего сохранения
            if (JSON.stringify(lastDocumentContent.current) !== JSON.stringify(contentToSave)) {
              console.log('Сохранение контента перед выходом...');
              
              // Отправляем данные с использованием navigator.sendBeacon
              if (navigator.sendBeacon) {
                const blob = new Blob([
                  JSON.stringify({
                    title,
                    content: contentToSave,
                    parent: document.parent
                  })
                ], { type: 'application/json' });
                
                const success = navigator.sendBeacon(`/api/documents/${document.id}/`, blob);
                console.log('Запрос sendBeacon отправлен:', success);
              } else {
                // Альтернативный вариант с fetch и keepalive
                fetch(`/api/documents/${document.id}/`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                  },
                  body: JSON.stringify({
                    title,
                    content: contentToSave,
                    parent: document.parent
                  }),
                  keepalive: true
                });
              }
              
              // Обновляем последнее сохраненное состояние
              lastDocumentContent.current = contentToSave;
            }
          } catch (editorErr) {
            console.error('Ошибка при получении контента редактора:', editorErr);
          }
        }
      } catch (err) {
        console.error('Ошибка при сохранении перед уходом:', err);
      }
    };
    
    // Регистрируем обработчик события beforeunload
    window.addEventListener('beforeunload', saveBeforeLeavingPage);
    
    // Очистка при размонтировании
    return () => {
      window.removeEventListener('beforeunload', saveBeforeLeavingPage);
    };
  }, [document.id, document.parent, title]);

  // Обновляем ссылку на последний контент при его сохранении
  useEffect(() => {
    lastDocumentContent.current = document.content;
  }, [document.content]);

  // Обновляет заголовок блока вложенного документа при получении соответствующего события
  const updateNestedDocumentTitle = useCallback((data: {id: string, title: string}) => {
    if (!editor || !editor.blocks) return;
    
    console.log('Получено обновление заголовка для документа:', data.id, data.title);
    
    // Проходим по всем блокам в редакторе
    const blockCount = editor.blocks.getBlocksCount();
    for (let i = 0; i < blockCount; i++) {
      try {
        // Получаем блок по индексу
        const block = editor.blocks.getBlockByIndex(i);
        if (!block) continue;
        
        // Получаем данные блока
        const blockData = block.save();
        
        // Проверяем, является ли это блоком nestedDocument с нужным id
        if (blockData && blockData.type === 'nestedDocument' && 
            blockData.data && blockData.data.id === data.id) {
          
          console.log('Найден блок для обновления заголовка:', i);
          
          // Создаем обновленные данные с новым заголовком
          const updatedData = {
            ...blockData.data,
            title: data.title
          };
          
          // Обновляем данные блока
          editor.blocks.update(i, updatedData);
          console.log('Обновлен заголовок блока вложенного документа');
        }
      } catch (err) {
        console.error('Ошибка при проверке блока для обновления заголовка:', err);
      }
    }
  }, [editor]);

  // Слушатель событий через localStorage для межвкладочной коммуникации
  useEffect(() => {
    // Обработчик для получения обновлений заголовков документов
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('document_title_update_')) {
        try {
          const data = JSON.parse(e.newValue || '');
          if (data && data.id && data.title) {
            updateNestedDocumentTitle(data);
          }
        } catch (err) {
          console.error('Ошибка при обработке события обновления заголовка:', err);
        }
      }
    };
    
    // Добавляем слушатель
    window.addEventListener('storage', handleStorageChange);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updateNestedDocumentTitle]);

  // Слушатель события обновления документа
  useEffect(() => {
    const handleDocumentRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.documentId === document.id) {
        console.log('Получено событие обновления документа, перезагружаем содержимое');
        reloadDocument();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'document_refresh') {
        try {
          const data = JSON.parse(event.newValue || '{}');
          if (data && data.documentId === document.id) {
            console.log('Получено событие обновления документа через localStorage, перезагружаем содержимое');
            reloadDocument();
          }
        } catch (e) {
          console.error('Ошибка при обработке события обновления из localStorage:', e);
        }
      }
    };

    // Функция для перезагрузки содержимого документа
    const reloadDocument = async () => {
      try {
        console.log('Перезагрузка содержимого документа');
        const response = await api.get(`/documents/${document.id}/`);
        if (response.data && response.data.content) {
          console.log('Получены обновленные данные документа');
          
          // Обновляем документ через коллбэк
          onChange({
            ...document,
            content: response.data.content
          });
          
          // Если редактор уже инициализирован, обновляем его содержимое
          if (editor) {
            editor.render(response.data.content);
            console.log('Редактор обновлен с новым содержимым');
          }
        }
      } catch (e) {
        console.error('Ошибка при перезагрузке документа:', e);
      }
    };

    // Добавляем слушатели событий
    window.addEventListener('document_refresh', handleDocumentRefresh);
    window.addEventListener('storage', handleStorageChange);

    // Удаляем слушатели при размонтировании
    return () => {
      window.removeEventListener('document_refresh', handleDocumentRefresh);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [document.id, editor, onChange]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
      {/* Поле заголовка */}
      <Input
        ref={titleInputRef}
        type="text"
        value={title}
        onChange={handleTitleChange}
        className="border-none text-3xl font-bold focus-visible:ring-0 px-0 bg-transparent"
        placeholder="Без заголовка"
      />
      
      {/* Контейнер для EditorJS */}
      <Card className={cn("border-none shadow-none")}>
        <CardContent className="p-0">
          <div 
            ref={editorRef} 
            className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none editor-js-container"
          />
        </CardContent>
      </Card>

      {/* Стили для EditorJS */}
      <style jsx global>{`
        /* Стили для заголовков */
        .ce-header {
          padding: 0.5em 0;
          margin: 0;
          line-height: 1.25em;
        }
        
        h2.ce-header {
          font-size: 1.75em;
          font-weight: 700;
        }
        
        h3.ce-header {
          font-size: 1.5em;
          font-weight: 600;
        }
        
        h4.ce-header {
          font-size: 1.25em;
          font-weight: 600;
        }
        
        /* Стили для списков */
        .cdx-list {
          margin: 0;
          padding-left: 40px;
          outline: none;
        }
        
        .cdx-list__item {
          padding: 5px 0;
          line-height: 1.5em;
        }
        
        /* Стили для чеклистов */
        .cdx-checklist__item {
          display: flex;
          align-items: flex-start;
          padding: 5px 0;
        }
        
        .cdx-checklist__item-checkbox {
          margin-right: 10px;
          cursor: pointer;
        }
        
        /* Общие стили для блоков */
        .ce-block {
          padding: 0.4em 0;
        }
        
        .ce-block__content {
          max-width: 100%;
          margin: 0 auto;
        }
        
        /* Стили для тулбара */
        .ce-toolbar__content {
          max-width: 100%;
        }
        
        .ce-toolbar__plus {
          color: #5a67d8;
        }
        
        .ce-toolbar__settings-btn {
          color: #5a67d8;
        }
      `}</style>
    </div>
  )
} 