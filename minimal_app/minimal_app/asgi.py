import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'minimal_app.settings')
django.setup() # Важно вызвать setup() до импорта приложения

django_asgi_app = get_asgi_application()

async def application(scope, receive, send):
    if scope['type'] == 'lifespan':
        while True:
            message = await receive()
            if message['type'] == 'lifespan.startup':
                await send({'type': 'lifespan.startup.complete'})
            elif message['type'] == 'lifespan.shutdown':
                await send({'type': 'lifespan.shutdown.complete'})
                return
    else:
        await django_asgi_app(scope, receive, send)