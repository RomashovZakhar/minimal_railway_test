"use client"

import { useState, useEffect, useRef } from "react"
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

  // Инициализация WebSocket соединения
  useEffect(() => {
    // Проверяем, что мы на клиенте и имеем необходимые данные
    if (typeof window === 'undefined' || !document.id || !user) return;

    let ws: WebSocket | null = null;
    
    // Оборачиваем всю логику WebSocket в try-catch
    try {
      // URL для WebSocket соединения
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 
        (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
        window.location.host + 
        `/ws/documents/${document.id}/`;
        
      console.log("Пытаемся подключиться к WebSocket по URL:", wsUrl);
      
      // Проверяем поддержку WebSocket в браузере
      if (typeof WebSocket === 'undefined') {
        console.warn('WebSocket не поддерживается в этом браузере');
        return;
      }

      // Создаем WebSocket соединение
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Цвет курсора для текущего пользователя
      const userColor = getRandomColor();

      // Обработка открытия соединения
      ws.onopen = () => {
        console.log('WebSocket соединение установлено');
        // Отправляем информацию о пользователе
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'cursor_connect',
            user_id: user.id,
            username: user.username || 'Пользователь',
            cursor_id: cursorIdRef.current,
            color: userColor
          }));
        }
      };

      // Обработка получения сообщений
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'cursor_update':
              // Обновляем позицию курсора другого пользователя
              break;
              
            case 'document_update':
              // Обновляем содержимое документа, если изменения пришли от другого пользователя
              if (data.sender_id !== cursorIdRef.current && editorInstanceRef.current) {
                editorInstanceRef.current.render(data.content);
              }
              break;
          }
        } catch (err) {
          console.error('Ошибка при обработке сообщения WebSocket:', err);
        }
      };

      // Обработка ошибок
      ws.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
        // При ошибке не закрываем соединение, просто логируем
      };

      // Обработка закрытия соединения
      ws.onclose = (event) => {
        console.log('WebSocket соединение закрыто', event.code, event.reason);
      };
    } catch (err) {
      console.warn('Не удалось инициализировать WebSocket:', err);
      // При ошибке инициализации просто продолжаем без WebSocket функциональности
    }

    // Очистка при размонтировании
    return () => {
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            // Отправляем сообщение только если соединение открыто
            ws.send(JSON.stringify({
              type: 'cursor_disconnect',
              cursor_id: cursorIdRef.current
            }));
            ws.close();
          } else if (ws.readyState === WebSocket.CONNECTING) {
            // Если еще подключаемся, закрываем без отправки сообщения
            ws.close();
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

  // Автосохранение
  useEffect(() => {
    let saveTimeout: NodeJS.Timeout | null = null;
    let contentToSave: any = null;
    
    // Функция для сохранения документа с дебаунсом
    const debouncedSave = async () => {
      if (!contentToSave) return;
      
      try {
        // Отправляем данные на сервер
        await api.put(`/documents/${document.id}/`, { 
          content: contentToSave,
          title 
        });
        
        // Отправляем обновления через WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'document_update',
            content: contentToSave,
            sender_id: cursorIdRef.current
          }));
        }
        
        console.log('Документ успешно сохранен');
        contentToSave = null;
      } catch (err) {
        console.error('Ошибка при автосохранении:', err);
      }
    };
    
    // Настраиваем событие для перехвата изменений и планирования сохранения
    const handleEditorChange = (newContent: any) => {
      contentToSave = newContent;
      
      // Очищаем предыдущий таймер, если он был
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      // Устанавливаем новый таймер для сохранения
      saveTimeout = setTimeout(() => {
        debouncedSave();
      }, 2000); // Задержка в 2 секунды
    };
    
    // Добавляем кастомное событие для отслеживания изменений в редакторе
    const handleCustomEvent = (e: CustomEvent) => {
      if (e.detail && e.detail.content) {
        handleEditorChange(e.detail.content);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('editorContentChanged', handleCustomEvent as EventListener);
    }
    
    return () => {
      // Отменяем таймер при размонтировании
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      // Финальное сохранение при размонтировании, если есть изменения
      if (contentToSave) {
        debouncedSave();
      }
      
      // Удаляем обработчик события
      if (typeof window !== 'undefined') {
        window.removeEventListener('editorContentChanged', handleCustomEvent as EventListener);
      }
    };
  }, [document.id, title]);

  useEffect(() => {
    // Динамический импорт EditorJS для клиентской стороны
    const initEditor = async () => {
      try {
        // Импортируем библиотеки только на клиенте
        if (typeof window !== "undefined" && editorRef.current) {
          const EditorJS = (await import('@editorjs/editorjs')).default;
          const Header = (await import('@editorjs/header')).default;
          const List = (await import('@editorjs/list')).default;
          const Checklist = (await import('@editorjs/checklist')).default;
          const Image = (await import('@editorjs/image')).default;

          // Если экземпляр редактора уже существует, не создаем новый
          if (editorInstanceRef.current) return;

          // Подготавливаем данные для редактора
          let editorData = document.content;
          console.log("Исходные данные документа:", document.content);
          
          // Проверяем формат данных и добавляем обязательные поля если они отсутствуют
          if (!editorData) {
            editorData = { blocks: [] };
          }
          
          // Добавляем обязательные свойства для EditorJS
          if (!editorData.time) {
            editorData.time = new Date().getTime();
          }
          
          if (!editorData.version) {
            editorData.version = "2.27.0";
          }
          
          console.log("Инициализация редактора с данными:", editorData);

          // Создаем экземпляр EditorJS с хорошо отформатированным контентом
          editorInstanceRef.current = new EditorJS({
            holder: editorRef.current,
            data: editorData,
            autofocus: true,
            placeholder: 'Нажмите "/" для вызова меню команд',
            tools: {
              header: Header,
              list: List,
              checklist: Checklist,
              image: Image,
              nestedDocument: NestedDocumentTool
            },
            onReady: () => {
              console.log("Editor.js успешно инициализирован");
            },
            onChange: async (api: any, event: any) => {
              if (!editorInstanceRef.current) return;
              
              try {
                const data = await editorInstanceRef.current.save();
                onChange({ ...document, content: data, title });
                
                // Создаем кастомное событие для автосохранения
                if (typeof window !== 'undefined') {
                  const customEvent = new CustomEvent('editorContentChanged', { 
                    detail: { content: data } 
                  });
                  window.dispatchEvent(customEvent);
                }
              } catch (err) {
                console.error("Ошибка при сохранении контента:", err);
              }
            }
          });
        }
      } catch (err) {
        console.error('Ошибка при инициализации EditorJS:', err);
      }
    };

    initEditor();

    // Очистка при размонтировании компонента
    return () => {
      if (editorInstanceRef.current) {
        try {
          if (typeof editorInstanceRef.current.destroy === 'function') {
            editorInstanceRef.current.destroy();
          } else if (typeof editorInstanceRef.current.clear === 'function') {
            editorInstanceRef.current.clear();
          }
        } catch (err) {
          console.error('Ошибка при уничтожении редактора:', err);
        }
        editorInstanceRef.current = null;
      }
    };
  }, [document.id]);  // Зависимость только от ID документа, чтобы не пересоздавать редактор при каждом изменении контента

  // Обновляем заголовок документа
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    onChange({ ...document, title: newTitle });
  };

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
            className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none"
          />
        </CardContent>
      </Card>
    </div>
  )
} 