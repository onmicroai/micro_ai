from django.shortcuts import get_object_or_404, render
from django.http import Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from rest_framework import status
from .models import MicroAppTemplate
from .serializers import MicroAppTemplateSerializer


# generic fucntion for getting template based on template id -> PK
def get_template_id(request, template_id):
    if request.method == "GET":
        try:
            return MicroAppTemplate.objects.get(id=template_id)
        except:
             raise Http404

# returns all or specific object based on template id -> PK
def get_template(request):
    if request.method == "GET":
        template_id = request.GET.get("id")
        if not template_id:
            try:
                query = MicroAppTemplate.objects.all()
            except:
                return JsonResponse({"error": "MicroAppTemplate not found"}, status=404)
            serializer = MicroAppTemplateSerializer(query, many=True)
            return JsonResponse(serializer.data, safe=False, status=200)
        try:
            query = get_template_id(template_id=template_id)
        except MicroAppTemplate.DoesNotExist:
            return JsonResponse({"error": "MicroAppTemplate not found"}, status=404)    
        serializer = MicroAppTemplateSerializer(query, many=True)    
        return JsonResponse(serializer.data, safe=False, status=200)
    else:
        return JsonResponse({"error": "Method not allowed"}, status=405)


# creates the template
def create_template(request):
    if request.method == 'POST':
        serializer = MicroAppTemplateSerializer(data=request.POST)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=status.HTTP_201_CREATED)
        return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    else:
        return JsonResponse({'error': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


# upadtes template based on template id -> PK
def update_template(request):
    if request.method == "PUT":
        template_id = request.GET.get("id")
        if not template_id:
            return JsonResponse({"error": "template id not defined"}, status=404)
        try:
            query = get_template_id(template_id=template_id)
            serializer = MicroAppTemplateSerializer(query, data=request.data)
        except MicroAppTemplate.DoesNotExist:
            return JsonResponse({"error": "MicroAppTemplate not found"}, status=404)
        
# deletes template based on template id -> PK
def delete_template(request):
        if request.method == "delete":
            template_id = request.GET.get("id")
            if not template_id:
                return JsonResponse({"error": "template id not defined"}, status=404)
            try:
                query = get_template_id(template_id)
                query.delete()
                return JsonResponse({}, status=status.HTTP_204_NO_CONTENT)
            except MicroAppTemplate.DoesNotExist:
                return JsonResponse({"error": "MicroAppTemplate not found"}, status=404)
        else:
            return JsonResponse({'error': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
        

