from django.urls import path
from main_app import views as main_app_views # Импортируем views из main_app

urlpatterns = [
    path('hello/', main_app_views.hello_world),
]