from django.urls import path
from .views import create_template, get_template, update_template, delete_template 

urlpatterns = [
    path('create/', create_template, name='create-microapp-template'),
    path('get/', get_template, name="get-microapp-template"),
    path('update/', update_template, name='update-microapp-template'),
    path('delete/', delete_template, name="delete-microapp-template"),
]
