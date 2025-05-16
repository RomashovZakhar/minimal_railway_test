from django.http import HttpResponse

def hello_world(request):
    return HttpResponse("Hello from Minimal Django on Railway!", status=200)