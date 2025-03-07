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

// Интерфейс для команд редактора
interface EditorCommand {
  name: string;
  icon: string;
  action: () => void;
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
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [commandMenuPosition, setCommandMenuPosition] = useState({ top: 0, left: 0 })
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<any>(null)
  const commandMenuRef = useRef<HTMLDivElement>(null)
  const cursorIdRef = useRef(nanoid())
  const cursorPositionRef = useRef<{blockIndex: number, offset: number} | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const router = useRouter()
  const { user } = useAuth()

  // Команды редактора
  const editorCommands: EditorCommand[] = [
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
    if (typeof window === 'undefined' || !document.id || !user) return;

    // URL для WebSocket соединения
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 
      (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
      window.location.host + 
      `/ws/documents/${document.id}/`;

    // Создаем WebSocket соединение
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Цвет курсора для текущего пользователя
    const userColor = getRandomColor();

    // Обработка открытия соединения
    ws.onopen = () => {
      console.log('WebSocket соединение установлено');
      // Отправляем информацию о пользователе
      ws.send(JSON.stringify({
        type: 'cursor_connect',
        user_id: user.id,
        username: user.username || 'Пользователь',
        cursor_id: cursorIdRef.current,
        color: userColor
      }));
    };

    // Обработка получения сообщений
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'cursor_update':
            // Обновляем позицию курсора другого пользователя
            if (data.cursor_id !== cursorIdRef.current) {
              setRemoteCursors(prev => {
                // Находим курсор в массиве
                const index = prev.findIndex(c => c.id === data.cursor_id);
                
                // Обновленная информация о курсоре
                const updatedCursor: RemoteCursor = {
                  id: data.cursor_id,
                  username: data.username,
                  color: data.color,
                  position: data.position,
                  timestamp: Date.now()
                };
                
                // Если курсор уже есть, обновляем его, иначе добавляем новый
                if (index !== -1) {
                  const newCursors = [...prev];
                  newCursors[index] = updatedCursor;
                  return newCursors;
                } else {
                  return [...prev, updatedCursor];
                }
              });
            }
            break;
            
          case 'document_update':
            // Обновляем содержимое документа, если изменения пришли от другого пользователя
            if (data.sender_id !== cursorIdRef.current && editorInstanceRef.current) {
              editorInstanceRef.current.render(data.content);
            }
            break;
            
          case 'cursor_disconnect':
            // Удаляем курсор отключившегося пользователя
            if (data.cursor_id !== cursorIdRef.current) {
              setRemoteCursors(prev => prev.filter(c => c.id !== data.cursor_id));
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
    };

    // Обработка закрытия соединения
    ws.onclose = () => {
      console.log('WebSocket соединение закрыто');
    };

    // Очистка при размонтировании
    return () => {
      if (ws && (ws.readyState === WebSocket.OPEN)) {
        // Отправляем сообщение только если соединение открыто
        ws.send(JSON.stringify({
          type: 'cursor_disconnect',
          cursor_id: cursorIdRef.current
        }));
        ws.close();
      } else if (ws) {
        // Просто закрываем соединение, если оно не в открытом состоянии
        ws.close();
      }
    };
  }, [document.id, user]);

  // Очистка неактивных курсоров
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // Удаляем курсоры, которые не обновлялись более 5 секунд
      const now = Date.now();
      setRemoteCursors(prev => 
        prev.filter(cursor => now - cursor.timestamp < 5000)
      );
    }, 5000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Рендеринг курсоров других пользователей
  useEffect(() => {
    if (!editorInstanceRef.current || remoteCursors.length === 0) return;

    // Удаляем все существующие отображения курсоров
    if (typeof window !== 'undefined') {
      window.document.querySelectorAll('.remote-cursor').forEach((el: Element) => el.remove());
    }

    // Создаем элементы курсоров для каждого удаленного пользователя
    remoteCursors.forEach(cursor => {
      if (!cursor.position) return;

      try {
        // Получаем блок и позицию для размещения курсора
        const blocks = editorInstanceRef.current.blocks.getAll();
        
        if (cursor.position.blockIndex >= blocks.length) return;
        
        const blockElement = blocks[cursor.position.blockIndex].holder;
        
        if (!blockElement) return;

        // Создаем элемент курсора
        if (typeof window !== 'undefined') {
          const cursorElement = window.document.createElement('div');
          cursorElement.className = 'remote-cursor';
          cursorElement.style.position = 'absolute';
          cursorElement.style.width = '2px';
          cursorElement.style.height = '20px';
          cursorElement.style.backgroundColor = cursor.color;
          cursorElement.style.zIndex = '100';
          
          // Добавляем имя пользователя в виде тултипа
          const nameTag = window.document.createElement('div');
          nameTag.className = 'cursor-name-tag';
          nameTag.textContent = cursor.username;
          nameTag.style.position = 'absolute';
          nameTag.style.top = '-20px';
          nameTag.style.left = '0';
          nameTag.style.backgroundColor = cursor.color;
          nameTag.style.color = '#fff';
          nameTag.style.padding = '2px 5px';
          nameTag.style.borderRadius = '3px';
          nameTag.style.fontSize = '10px';
          nameTag.style.whiteSpace = 'nowrap';
          
          cursorElement.appendChild(nameTag);
          
          // Размещаем курсор в определенной позиции
          // Это упрощенное позиционирование, в реальном приложении нужно учитывать
          // точное положение в тексте
          cursorElement.style.left = `${10 + cursor.position.offset * 8}px`;
          cursorElement.style.top = '0';
          
          blockElement.style.position = 'relative';
          blockElement.appendChild(cursorElement);
        }
      } catch (err) {
        console.error('Ошибка при отрисовке удаленного курсора:', err);
      }
    });
  }, [remoteCursors]);

  // Отправка позиции курсора
  const sendCursorPosition = (position: {blockIndex: number, offset: number} | null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    // Сохраняем текущую позицию
    cursorPositionRef.current = position;
    
    // Отправляем данные о позиции
    wsRef.current.send(JSON.stringify({
      type: 'cursor_update',
      cursor_id: cursorIdRef.current,
      position,
      username: user?.username || 'Пользователь'
    }));
  };

  // Закрытие меню команд при клике вне его
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        commandMenuRef.current && 
        !commandMenuRef.current.contains(e.target as Node) && 
        showCommandMenu
      ) {
        setShowCommandMenu(false)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener("mousedown", handleClickOutside)
      return () => {
        window.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [showCommandMenu])

  // Автосохранение
  useEffect(() => {
    let saveInterval: NodeJS.Timeout;
    
    if (editorInstanceRef.current && typeof window !== 'undefined') {
      // Сохраняем изменения каждые 3 секунды
      saveInterval = setInterval(async () => {
        if (editorInstanceRef.current) {
          const data = await editorInstanceRef.current.save();
          onChange({ ...document, content: data, title });
          
          // Отправляем данные на сервер
          try {
            await api.put(`/documents/${document.id}/`, { 
              content: data,
              title 
            });
            
            // Отправляем обновления через WebSocket
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'document_update',
                content: data,
                sender_id: cursorIdRef.current
              }));
            }
          } catch (err) {
            console.error('Ошибка при автосохранении:', err);
          }
        }
      }, 3000);
    }
    
    return () => {
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [document.id, title, onChange]);

  useEffect(() => {
    // Динамический импорт EditorJS для клиентской стороны
    const initEditor = async () => {
      try {
        // Импортируем библиотеки только на клиенте
        if (typeof window !== "undefined" && editorRef.current) {
          const EditorJS = (await import('@editorjs/editorjs')).default
          const Header = (await import('@editorjs/header')).default
          const List = (await import('@editorjs/list')).default
          const Checklist = (await import('@editorjs/checklist')).default
          const Image = (await import('@editorjs/image')).default

          // Если экземпляр редактора уже существует, не создаем новый
          if (editorInstanceRef.current) return;

          // Создаем экземпляр EditorJS
          try {
            console.log("Инициализирую Editor.js с данными:", document.content || { blocks: [] });
            console.log("Holder элемент:", editorRef.current);
            
            editorInstanceRef.current = new EditorJS({
              holder: editorRef.current,
              data: document.content || { blocks: [] },
              autofocus: false,
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
                const data = await editorInstanceRef.current.save();
                onChange({ ...document, content: data, title });
                
                // Определяем текущую позицию курсора
                if (event && event.type === 'block-changed') {
                  // Упрощенно: берем индекс блока и условную позицию внутри
                  const blockIndex = event.detail.index;
                  const offset = 0; // Это упрощение, на практике нужно определять точную позицию
                  
                  sendCursorPosition({ blockIndex, offset });
                }
              }
            });
          } catch (editorError) {
            console.error("Ошибка при инициализации Editor.js:", editorError);
            console.log("Состояние DOM и данных:", {
              editorElement: editorRef.current,
              documentContent: document.content
            });
          }
          
          // Добавляем обработчики событий для определения позиции курсора
          editorRef.current?.addEventListener('click', (e) => {
            if (!editorInstanceRef.current) return;
            
            // Определяем, в каком блоке произошел клик
            const blocks = editorInstanceRef.current.blocks.getAll();
            let targetBlock = null;
            let blockIndex = -1;
            
            for (let i = 0; i < blocks.length; i++) {
              const block = blocks[i].holder;
              if (block && block.contains(e.target as Node)) {
                targetBlock = block;
                blockIndex = i;
                break;
              }
            }
            
            if (blockIndex !== -1) {
              // Расчет примерного смещения внутри блока
              // Это упрощение, в реальном приложении нужно более точное определение
              const rect = targetBlock.getBoundingClientRect();
              const offset = Math.floor((e.clientX - rect.left) / 8); // 8px - примерная ширина символа
              
              sendCursorPosition({ blockIndex, offset });
            }
          });
          
          // При вводе текста также обновляем позицию
          editorRef.current?.addEventListener('keyup', () => {
            if (!editorInstanceRef.current || !cursorPositionRef.current) return;
            
            // Увеличиваем offset при вводе текста
            // В реальном приложении нужно более точное определение
            const updatedPosition = {
              ...cursorPositionRef.current,
              offset: cursorPositionRef.current.offset + 1
            };
            
            sendCursorPosition(updatedPosition);
          });
        }
      } catch (err) {
        console.error('Ошибка при инициализации EditorJS:', err);
      }
    };

    initEditor();

    return () => {
      // Уничтожаем экземпляр редактора при размонтировании
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
    };
  }, [document.id, onChange, title]);

  // Обработчик для "/" команд
  useEffect(() => {
    const handleSlashCommands = (e: KeyboardEvent) => {
      if (e.key === '/' && editorRef.current) {
        // Создаем событие "/", остановив обычный ввод
        e.preventDefault();
        
        // Получаем позицию курсора для размещения меню
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Устанавливаем позицию меню команд
          setCommandMenuPosition({
            top: rect.bottom,
            left: rect.left
          });
          
          // Показываем меню команд
          setShowCommandMenu(true);
        }
      }
    };

    // Добавляем обработчик только на клиенте
    if (typeof window !== "undefined") {
      window.addEventListener('keydown', handleSlashCommands);
      
      return () => {
        window.removeEventListener('keydown', handleSlashCommands);
      };
    }
  }, []);

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

      {/* Меню команд */}
      {showCommandMenu && (
        <div
          ref={commandMenuRef}
          className="absolute z-50 bg-background border rounded-md shadow-md p-2 w-64"
          style={{
            top: `${commandMenuPosition.top}px`,
            left: `${commandMenuPosition.left}px`
          }}
        >
          <div className="text-sm text-muted-foreground mb-2 px-2">
            Выберите команду:
          </div>
          <div className="flex flex-col gap-1">
            {editorCommands.map((command) => (
              <Button
                key={command.name}
                variant="ghost"
                className="justify-start text-sm"
                onClick={() => {
                  command.action();
                  setShowCommandMenu(false);
                }}
              >
                <span className="w-6 text-center mr-2">{command.icon}</span>
                {command.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 