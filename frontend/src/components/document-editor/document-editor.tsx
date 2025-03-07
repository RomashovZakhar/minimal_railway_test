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
    
    static get toolbox() {
      return {
        title: 'Вложенный документ',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 5V19H5V5H19ZM21 3H3V21H21V3ZM17 7H7V9H17V7ZM14 11H7V13H14V11Z" fill="currentColor"/></svg>'
      };
    }

    constructor({ data, api, block }: { data: any, api: any, block: HTMLElement }) {
      this.api = api;
      this.data = data || { id: '', title: 'Новый документ' };
      this.block = block;
    }

    async render() {
      const wrapper = document.createElement('div');
      wrapper.classList.add('nested-document-block');
      wrapper.style.padding = '15px';
      wrapper.style.border = '1px solid #e2e8f0';
      wrapper.style.borderRadius = '6px';
      wrapper.style.marginBottom = '15px';
      wrapper.style.backgroundColor = '#f8fafc';
      wrapper.style.cursor = 'pointer';
      
      const icon = document.createElement('span');
      icon.innerHTML = '📄';
      icon.style.marginRight = '10px';
      
      const title = document.createElement('span');
      title.textContent = this.data.title;
      title.style.fontWeight = 'bold';
      
      wrapper.appendChild(icon);
      wrapper.appendChild(title);
      
      // Если документ уже создан, добавляем обработчик для перехода
      if (this.data.id) {
        wrapper.addEventListener('click', () => {
          window.location.href = `/documents/${this.data.id}`;
        });
      } else {
        // Создаем новый документ при первом рендере
        try {
          const response = await fetch('/api/documents/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            },
            body: JSON.stringify({
              title: this.data.title,
              parent: window.location.pathname.split('/').pop()
            })
          });
          
          const newDoc = await response.json();
          this.data.id = newDoc.id;
          
          // Теперь добавляем обработчик для перехода
          wrapper.addEventListener('click', () => {
            window.location.href = `/documents/${this.data.id}`;
          });
        } catch (err) {
          console.error('Ошибка при создании вложенного документа:', err);
        }
      }
      
      return wrapper;
    }

    save() {
      return this.data;
    }
  }
}

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

export function DocumentEditor({ document, onChange }: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title)
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<any>(null)
  const cursorIdRef = useRef(nanoid())
  const cursorPositionRef = useRef<{blockIndex: number, offset: number} | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const router = useRouter()
  const { user } = useAuth()

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
  
  // Автосохранение с дебаунсингом
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
                defaultLevel: 2
              }
            },
            list: {
              class: List,
              inlineToolbar: true,
              config: {
                defaultStyle: 'unordered'
              }
            },
            checklist: {
              class: Checklist,
              inlineToolbar: true
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

  // Последний контент для сохранения при выходе
  const lastDocumentContent = useRef<any>(document.content);
  
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

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
      {/* Поле заголовка */}
      <Input
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