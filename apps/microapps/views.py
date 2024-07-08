from django.shortcuts import render
from django.http import Http404, JsonResponse
from django.shortcuts import render
from rest_framework.response import Response
from apps.microapps.serializer import MicroAppSerializer, MicroappUserSerializer, AssetsSerializer, AssetsMicroappSerializer
from rest_framework import status
from rest_framework.decorators import api_view
from apps.microapps.models import Microapps, MicroAppUserJoin, AssetsMaJoin, Assets
from apps.global_microapps.models import GlobalMicroapps 
from apps.collection.models import CollectionMaJoin
from rest_framework.views import APIView

class MicroAppList(APIView):
   
   def add_microapp_user(self, request, microapp):
        
        role = request.data.get('role')  # always admin
        ma_id = microapp.id  
        user_id = request.user.id
        data = {'role': role, 'ma_id': ma_id, 'user_id': user_id}
        serializer = MicroappUserSerializer(data=data) 
        if serializer.is_valid():
            return serializer.save()
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            

   def add_assets(self, request, microapp):
       assets = request.data.get('assets')
       serializer = AssetsSerializer(data=assets)
       if serializer.is_valid():
           asset = serializer.save()
           return self.add_microapp_assets(microapp=microapp, asset=asset)
       
       return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
   
   def add_microapp_assets(self, microapp, asset):
       data = {'ma_id': microapp.id, 'asset_id': asset.id}
       serializer = AssetsMicroappSerializer(data=data)
       if serializer.is_valid():
           return serializer.save()
       
       return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)   

   def get(self, request, format=None):
        microapps = Microapps.objects.all()
        serializer = MicroAppSerializer(microapps, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
   
   def post(self, request, format=None):
        serializer = MicroAppSerializer(data=request.data.get('data'))
        if serializer.is_valid():
            microapp = serializer.save()
            self.add_microapp_user(request=request, microapp=microapp)
            self.add_assets(request=request, microapp=microapp)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
   
   
class MicroAppDetails(APIView):

    def get_object(self, pk):
        try:
            return Microapps.objects.get(id=pk)
        except Microapps.DoesNotExist:
            raise Http404
        
    def get(self, request, pk, format=None):
        snippet = self.get_object(pk)
        serializer = Microapps(snippet, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def put(self, request, pk, format=None):
        microapps = self.get_object(pk)
        serializer = MicroAppSerializer(microapps, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk, format=None):
        microapps = self.get_object(pk)
        microapps.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    

@api_view(["GET"])
def clone_app(request, pk):
    try:
        global_app = GlobalMicroapps.objects.get(id=pk)
        global_app["global_ma_id"] = global_app["id"]
        del global_app["id"]
        serializer = MicroAppSerializer(data=global_app)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except GlobalMicroapps.DoesNotExist:
        raise Http404
    
@api_view(["GET"])
def user_microapps(request):
    try: 
        current_user = request.user.id
        user_apps_ids = MicroAppUserJoin.objects.filter(user_id=current_user).values_list('ma_id', flat=True)
        user_apps = Microapps.objects.filter(id__in=user_apps_ids)
        serializer = MicroAppSerializer(user_apps, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except Microapps.DoesNotExist:
        raise Http404
    
@api_view(["POST"])
def add_microapp_users(request):
    ma_id = request.data.get('ma_id')
    users = request.data.get('users')
    
    microapp_user_instances = []
    for user_data in users:
        data = {'ma_id': ma_id, 'user_id': user_data['id'], 'role': user_data['role']}
        serializer = MicroappUserSerializer(data=data)
        if serializer.is_valid():
            microapp_user_instances.append(MicroAppUserJoin(**serializer.validated_data))
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    MicroAppUserJoin.objects.bulk_create(microapp_user_instances)
    
    return Response(status=status.HTTP_201_CREATED)


# @api_view(["GET"])
# def collection_microapps(request, collection_id):
#     try:
#         collection_apps_ids = CollectionMaJoin.objects.filter(collection_id=collection_id).values_list('ma_id',flat=True)
#         collection_apps = Microapps.objects.filter(id__in=collection_apps_ids)
#         serializer = MicroAppSerializer(collection_apps,many=True)
#         return Response(serializer.data, status=status.HTTP_200_OK)

#     except Microapps.DoesNotExist:
#         raise Http404
    

    




    