from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from .models import MicroAppTemplate
from .serializers import MicroAppTemplateSerializer

@csrf_exempt
def create_microapp_template(request):
    if request.method == 'POST':
        serializer = MicroAppTemplateSerializer(data=request.POST)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=status.HTTP_201_CREATED)
        return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    else:
        return JsonResponse({'error': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


def get_microapp_template(request):
    if request.method == "GET":
        template_id = request.GET.get("id")
        if not template_id:
            return JsonResponse({"error": "ID is required"}, status=400)
        try:
            template = MicroAppTemplate.objects.get(id=template_id)
        except MicroAppTemplate.DoesNotExist:
            return JsonResponse({"error": "MicroAppTemplate not found"}, status=404)

        serializer = MicroAppTemplateSerializer(template)
        
        return JsonResponse(serializer.data, safe=False, status=200)
    else:
        return JsonResponse({"error": "Method not allowed"}, status=405)