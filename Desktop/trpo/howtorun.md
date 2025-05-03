### Первый терминал

1. cd backend
2. venv\Scripts\activate
3. python manage.py runserver

### Второй терминал

1. cd backend
2. venv\Scripts\activate
3. daphne -p 8001 daphne_startup:application

### Третий терминал

1. cd frontend
2. npm run dev