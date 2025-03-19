import React from 'react';
import { Calendar, Clock, Trash2, Users } from 'lucide-react';

// Определяем пользовательские типы для инструмента
interface API {
  blocks: {
    update: (blockIndex: string, data: Record<string, unknown>) => void;
    delete: () => void;
    getCurrentBlockIndex: () => string | number;
  };
}

interface BlockToolData {
  text?: string;
  checked?: boolean;
  description?: string;
  deadline?: string;
  assignees?: string[];
  reminder?: string;
  expanded?: boolean;
}

interface BlockTool {
  save: () => unknown;
  render: () => HTMLElement;
}

export default class TaskTool implements BlockTool {
  private api: API;
  private readOnly: boolean;
  private data: BlockToolData;
  private _element: HTMLElement;
  private _wrapper: HTMLElement;
  private _lastExpandedState: boolean | undefined;

  static get toolbox() {
    return {
      title: 'Задача',
      icon: '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6 9L8 11L12 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
  }
  
  // Указываем EditorJS, что этот блок не должен дублироваться при клике
  static get enableLineBreaks() {
    return true;
  }
  
  // Указываем EditorJS, что этот блок является самостоятельным и не должен трактоваться как параграф
  static get isBlock() {
    return true;
  }
  
  // Отключаем инлайн тулбар для этого блока
  static get disableInlineToolbar() {
    return true;
  }

  constructor({ api, data, readOnly }: { api: API; data: BlockToolData; readOnly: boolean }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      text: data.text || '',
      checked: data.checked || false,
      description: data.description || '',
      deadline: data.deadline || '',
      assignees: data.assignees || [],
      reminder: data.reminder || '',
      expanded: data.expanded || false
    };

    this._element = document.createElement('div');
    this._wrapper = document.createElement('div');
  }

  static get sanitize() {
    return {
      text: true,
      checked: false,
      description: true,
      deadline: true,
      assignees: true,
      reminder: true,
      expanded: false
    };
  }

  render() {
    this._element.classList.add('task-tool');
    // Добавляем атрибуты, которые сообщают EditorJS, что это специальный блок
    this._element.dataset.skipActionsCheck = 'true';
    this._element.dataset.noFocus = 'true';
    this._element.draggable = false;
    
    const taskHeader = document.createElement('div');
    taskHeader.classList.add('task-header');
    taskHeader.draggable = false;
    
    // Обработчик для предотвращения любых действий по умолчанию на всем блоке
    this._element.addEventListener('click', (e) => {
      if (e && e.target && e.target === this._element) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true); // Используем capturing phase
    
    // Создаем чекбокс
    const checkbox = document.createElement('div');
    checkbox.classList.add('task-checkbox');
    checkbox.innerHTML = this.data.checked 
      ? '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><rect width="18" height="18" rx="9" fill="#007AFF"/><path d="M5 9L8 12L13 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="8" stroke="#C7C7CC" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';
    
    // Останавливаем всплытие события на всех возможных фазах
    checkbox.onpointerdown = (e) => {
      if (e) e.stopPropagation();
    };
    
    checkbox.onmousedown = (e) => {
      if (e) e.stopPropagation();
    };
    
    checkbox.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.data.checked = !this.data.checked;
      this.updateRender();
      this.updateData();
    };
    
    // Также делаем его не перетаскиваемым
    checkbox.draggable = false;
    
    // Создаем текстовое поле для названия задачи
    const taskText = document.createElement('div');
    taskText.classList.add('task-text');
    if (this.data.checked) {
      taskText.classList.add('task-text-completed');
    }
    taskText.contentEditable = !this.readOnly ? 'true' : 'false';
    taskText.innerHTML = this.data.text || '';
    
    // Предотвращаем создание новых задач при нажатии Enter
    taskText.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return true;
    };
    
    // Обработчик для сохранения текста при потере фокуса
    taskText.onblur = () => {
      this.data.text = taskText.innerHTML;
      this.updateData();
    };
    
    // Предотвращаем обработку кликов, кроме как для установки фокуса
    taskText.onclick = (e) => {
      if (document.activeElement !== taskText) {
        e.stopPropagation();
      }
    };
    
    // Также делаем его не перетаскиваемым
    taskText.draggable = false;
    
    // Создаем кнопку для раскрытия/сворачивания задачи
    const toggleButton = document.createElement('button');
    toggleButton.className = 'task-toggle-btn';
    toggleButton.type = 'button';
    toggleButton.innerHTML = this.data.expanded 
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    
    // Останавливаем всплытие события на всех возможных фазах
    toggleButton.onpointerdown = (e) => {
      if (e) e.stopPropagation();
    };
    
    toggleButton.onmousedown = (e) => {
      if (e) e.stopPropagation();
    };
    
    toggleButton.onclick = (e) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      this.data.expanded = !this.data.expanded;
      this.updateRender();
      this.updateData();
    };
    
    // Также делаем его не перетаскиваемым
    toggleButton.draggable = false;
    
    taskHeader.appendChild(checkbox);
    taskHeader.appendChild(taskText);
    taskHeader.appendChild(toggleButton);
    
    this._element.appendChild(taskHeader);
    
    // Создаем блок деталей задачи
    const taskDetails = document.createElement('div');
    taskDetails.classList.add('task-details');
    
    // Если задача раскрыта, показываем детали
    if (this.data.expanded) {
      // Добавляем класс для анимации
      setTimeout(() => {
        taskDetails.classList.add('task-details-expanded');
      }, 10);
      
      // Создаем поле для описания
      const taskDescription = document.createElement('div');
      taskDescription.classList.add('task-description');
      taskDescription.contentEditable = !this.readOnly ? 'true' : 'false';
      taskDescription.dataset.placeholder = 'Добавить описание...';
      taskDescription.innerHTML = this.data.description || '';
      
      taskDescription.addEventListener('blur', (event) => {
        if (taskDescription && taskDescription.innerHTML !== undefined) {
          this.data.description = taskDescription.innerHTML;
          this.updateData();
        }
      });
      
      // Создаем панель с кнопками
      const taskControls = document.createElement('div');
      taskControls.classList.add('task-controls');
      
      // Кнопка для дедлайна
      const deadlineButton = document.createElement('button');
      deadlineButton.classList.add('task-control-btn');
      deadlineButton.title = 'Установить дедлайн';
      deadlineButton.innerHTML = this.renderIcon(Calendar);
      
      if (this.data.deadline) {
        const deadlineLabel = document.createElement('span');
        deadlineLabel.textContent = this.data.deadline;
        deadlineButton.appendChild(deadlineLabel);
      }
      
      // Кнопка для назначения ответственных
      const assignButton = document.createElement('button');
      assignButton.classList.add('task-control-btn');
      assignButton.innerHTML = this.renderIcon(Users);
      assignButton.title = 'Назначить ответственных';
      
      const assignText = document.createElement('span');
      assignText.textContent = 'Ответственные';
      assignButton.appendChild(assignText);
      
      // Кнопка для напоминания
      const reminderButton = document.createElement('button');
      reminderButton.classList.add('task-control-btn');
      reminderButton.title = 'Установить напоминание';
      reminderButton.innerHTML = this.renderIcon(Clock);
      
      if (this.data.reminder) {
        const reminderLabel = document.createElement('span');
        reminderLabel.textContent = this.data.reminder;
        reminderButton.appendChild(reminderLabel);
      }
      
      // Кнопка для удаления
      const deleteButton = document.createElement('button');
      deleteButton.classList.add('task-control-btn', 'task-delete-btn');
      deleteButton.title = 'Удалить задачу';
      deleteButton.innerHTML = this.renderIcon(Trash2);
      
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
          this.api.blocks.delete();
        }
      });
      
      // Добавляем все кнопки к панели управления
      taskControls.appendChild(deadlineButton);
      taskControls.appendChild(assignButton);
      taskControls.appendChild(reminderButton);
      taskControls.appendChild(deleteButton);
      
      // Добавляем все элементы к деталям задачи
      taskDetails.appendChild(taskDescription);
      taskDetails.appendChild(taskControls);
    }
    
    // Добавляем блок деталей всегда, но разворачиваем только если expanded === true
    this._element.appendChild(taskDetails);
    
    // Стили для компонента
    this.injectStyles();
    
    return this._element;
  }

  // Обновление рендера при изменении состояния
  updateRender() {
    // Если меняется только состояние чекбокса, обновляем только нужные элементы без полной перерисовки
    const checkbox = this._element.querySelector('.task-checkbox');
    const taskText = this._element.querySelector('.task-text');
    
    if (checkbox && taskText) {
      // Обновляем чекбокс
      checkbox.innerHTML = this.data.checked 
        ? '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><rect width="18" height="18" rx="9" fill="#007AFF"/><path d="M5 9L8 12L13 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="8" stroke="#C7C7CC" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';
      
      // Обновляем стиль текста
      if (this.data.checked) {
        taskText.classList.add('task-text-completed');
      } else {
        taskText.classList.remove('task-text-completed');
      }
    }
    
    // Делаем полную перерисовку при изменении состояния развернутости
    const oldElement = this._element;
    this._element = document.createElement('div');
    this.render();
    if (oldElement && oldElement.parentElement) {
      oldElement.replaceWith(this._element);
    }
  }

  // Метод для получения текущих данных
  save() {
    return this.data;
  }

  // Метод для обновления данных в API
  updateData() {
    // Приводим наши данные к типу, ожидаемому API
    const dataToUpdate = { 
      text: this.data.text,
      checked: this.data.checked,
      description: this.data.description,
      deadline: this.data.deadline,
      assignees: this.data.assignees,
      reminder: this.data.reminder,
      expanded: this.data.expanded
    } as Record<string, unknown>;
    
    try {
      // Поскольку EditorJS API ожидает индекс блока, используем getCurrentBlockIndex
      const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
      if (currentBlockIndex !== undefined) {
        // Преобразуем индекс в строку, так как API ожидает строковый параметр
        this.api.blocks.update(String(currentBlockIndex), dataToUpdate);
      } else {
        console.warn('Не удалось получить индекс текущего блока задачи');
      }
    } catch (error) {
      console.error('Ошибка при обновлении данных задачи:', error);
    }
  }

  // Вспомогательный метод для рендеринга иконок из lucide-react
  renderIcon(Icon: typeof Calendar | typeof Clock | typeof Trash2 | typeof Users) {
    try {
      // Создаем SVG напрямую вместо конвертации React элемента
      const iconSvgMap = {
        [Calendar.name]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" ry="3"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
        [Clock.name]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        [Users.name]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        [Trash2.name]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
      };
      
      return iconSvgMap[Icon.name] || '';
    } catch (error) {
      console.error('Ошибка при рендеринге иконки:', error);
      return '';
    }
  }

  // Инжект стилей для компонента
  injectStyles() {
    if (typeof document === 'undefined') return;
    
    if (!document.querySelector('#task-tool-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'task-tool-styles';
      styleElement.textContent = `
        .task-tool {
          margin: 16px 0;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          border-radius: 8px;
          background-color: rgba(255, 255, 255, 0.4);
          border: 1px solid rgba(0, 0, 0, 0.05);
        //   box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        //   transition: box-shadow 0.2s ease, transform 0.1s ease;
          overflow: hidden;
        }
        
        .dark .task-tool {
          background-color: rgba(30, 30, 30, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
        //   box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        
        .task-header {
          display: flex;
          align-items: center;
          padding: 14px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        
        // .task-header:hover {
        //   background-color: rgba(0, 0, 0, 0.015);
        // }
        
        // .dark .task-header:hover {
        //   background-color: rgba(255, 255, 255, 0.02);
        // }
        
        .task-checkbox {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          flex-shrink: 0;
          color: #007AFF;
          cursor: pointer;
          width: 20px;
          height: 20px;
          transition: transform 0.15s ease;
        }
        
        .task-checkbox:hover {
          transform: scale(1.1);
        }
        
        .task-text {
          flex: 1;
          font-size: 15px;
          line-height: 1.4;
          outline: none;
          text-decoration: none;
          word-break: break-word;
          color: #000;
          font-weight: 400;
          padding: 2px 0;
        }
        
        .dark .task-text {
          color: #FFF;
        }
        
        .task-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          width: 24px;
          height: 24px;
          padding: 0;
          margin-left: 8px;
          border-radius: 4px;
          color: #8A8A8A;
          cursor: pointer;
          opacity: 0.5;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        
        // .task-toggle-btn:hover {
        //   background-color: rgba(0, 0, 0, 0.06);
        //   opacity: 0.8;
        // }
        
        // .dark .task-toggle-btn:hover {
        //    background-color: rgba(255, 255, 255, 0.06);
        // }
        
        .task-details {
        //   border-top: 1px solid rgba(0, 0, 0, 0.04);
          margin-top: 0;
        //   background-color: rgba(0, 0, 0, 0.01);
          max-height: 0;
          overflow: hidden;
        //   transition: all 0.3s ease;
          opacity: 0;
        }
        
        .dark .task-details {
        //   border-top: 1px solid rgba(255, 255, 255, 0.04);
        //   background-color: rgba(255, 255, 255, 0.01);
        }
        
        .task-details-expanded {
          padding: 0px 16px 16px 48px;
          max-height: 500px;
          opacity: 1;
        }
        
        .task-description {
          font-size: 14px;
          color: #6F6F6F;
          line-height: 1.5;
          margin: 12px 0 20px 0;
          outline: none;
          min-height: 21px;
          padding: 0;
        }
        
        .dark .task-description {
          color: #A0A0A0;
        }
        
        .task-description:empty:before {
          content: attr(data-placeholder);
          color: #B8B8B8;
          opacity: 0.8;
        }
        
        .dark .task-description:empty:before {
          color: #666;
        }
        
        .task-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        
        .task-control-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #6F6F6F;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.05);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .dark .task-control-btn {
          color: #A0A0A0;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }
        
        .task-control-btn:hover {
          background: rgba(0, 0, 0, 0.07);
          color: #000;
          border-color: rgba(0, 0, 0, 0.1);
        }
        
        .dark .task-control-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #FFF;
          border-color: rgba(255, 255, 255, 0.12);
        }
        
        .task-control-btn:active {
          transform: translateY(1px);
        }
        
        .task-delete-btn {
          margin-left: auto;
          color: #FF3B30;
          opacity: 0.8;
        }
        
        .task-delete-btn:hover {
          color: #FF3B30;
          opacity: 1;
          background: rgba(255, 59, 48, 0.1);
        }
        
        .task-text-completed {
          text-decoration: line-through;
          color: #8E8E93 !important;
          opacity: 0.7;
          transition: color 0.2s ease, opacity 0.2s ease, text-decoration 0.2s ease;
        }
        
        .dark .task-text-completed {
          color: #8E8E93 !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
  }
} 