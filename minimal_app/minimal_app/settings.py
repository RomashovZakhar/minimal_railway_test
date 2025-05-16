from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'django-insecure-thisisveryinsecureandtemporarykey' # Для теста
DEBUG = False # Важно для теста на Railway
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'main_app', # Наше приложение
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]
MIDDLEWARE = [ # Самый минимум
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'minimal_app.urls'
TEMPLATES = [] # Не нужны для этого теста
WSGI_APPLICATION = 'minimal_app.wsgi.application'
DATABASES = {} # Не нужны для этого теста
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
ASGI_APPLICATION = 'minimal_app.asgi.application' # Указываем ASGI