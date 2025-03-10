#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Запуск полного стека приложения (бэкенд, WebSocket, фронтенд)${NC}"

# Функция для очистки при завершении
cleanup() {
    echo -e "${YELLOW}Останавливаю все процессы...${NC}"
    kill $DJANGO_PID $DAPHNE_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Отлавливаем сигналы завершения
trap cleanup SIGINT SIGTERM

# Проверяем, не занят ли порт 8000
if lsof -i :8000 >/dev/null 2>&1; then
    echo -e "${RED}Порт 8000 уже занят. Освобождаю порт...${NC}"
    lsof -i :8000 -t | xargs kill -9 2>/dev/null
    sleep 1
fi

# Проверяем, не занят ли порт 3000
if lsof -i :3000 >/dev/null 2>&1; then
    echo -e "${RED}Порт 3000 уже занят. Освобождаю порт...${NC}"
    lsof -i :3000 -t | xargs kill -9 2>/dev/null
    sleep 1
fi

# Запускаем Django-сервер в фоне
echo -e "${GREEN}Запускаю Django-сервер...${NC}"
cd backend && python manage.py runserver 0.0.0.0:8000 &
DJANGO_PID=$!
cd ..

echo -e "${GREEN}Django сервер запущен с PID: $DJANGO_PID${NC}"
sleep 3  # Даем время Django запуститься

# Запускаем Daphne для WebSocket
echo -e "${GREEN}Запускаю Daphne для WebSocket...${NC}"
cd backend && daphne -p 8001 daphne_startup:application &
DAPHNE_PID=$!
cd ..

echo -e "${GREEN}Daphne запущен с PID: $DAPHNE_PID${NC}"
sleep 2  # Даем время Daphne запуститься

# Запускаем фронтенд
echo -e "${GREEN}Запускаю фронтенд...${NC}"
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}Фронтенд запущен с PID: $FRONTEND_PID${NC}"

echo -e "${YELLOW}Все компоненты запущены. Нажмите Ctrl+C для остановки всех процессов.${NC}"
echo -e "${GREEN}Фронтенд доступен по адресу: http://localhost:3000${NC}"
echo -e "${GREEN}Бэкенд API доступен по адресу: http://localhost:8000/api/${NC}"
echo -e "${GREEN}WebSocket доступен по адресу: ws://localhost:8001/ws/documents/<ID>/${NC}"

# Изменяем порт для WebSocket на фронтенде
echo -e "${YELLOW}Настраиваю порт WebSocket на фронтенде...${NC}"
cd frontend && node -e "
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'src/components/document-editor/document-editor.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/const host = 'localhost:8000';/g, \"const host = 'localhost:8001';\");
fs.writeFileSync(filePath, content);
console.log('Порт WebSocket изменен на 8001');
" &

# Ждем завершения всех процессов
wait 