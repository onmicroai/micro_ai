from django.urls import path
from .views import create_microapp_template 
from .views import get_microapp_template

urlpatterns = [
    path('create-microapp/', create_microapp_template, name='create-microapp-template'),
    path('get-microapp/', get_microapp_template, name="get-microapp-template")
]
