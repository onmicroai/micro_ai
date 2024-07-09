from django.http import Http404
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from apps.global_microapps.serializer import (
    GlobalMicroAppsSerializer,
    AssetsSerializer,
    AssetsGlobalappSerializer
)
from apps.global_microapps.models import GlobalMicroapps
from rest_framework.decorators import api_view

class GlobalAppList(APIView):

    def add_assets(self, request, globalapp):
        assets = request.data.get('assets')
        serializer = AssetsSerializer(data=assets)
        if serializer.is_valid():
            asset = serializer.save()
            return self.add_globalapp_assets(globalapp=globalapp, asset=asset)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
   
    def add_globalapp_assets(self, globalapp, asset):
        data = {'global_app_id': globalapp.id, 'asset_id': asset.id}
        serializer = AssetsGlobalappSerializer(data=data)
        if serializer.is_valid():
            return serializer.save()
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, format=None):
        global_apps = GlobalMicroapps.objects.all()
        serializer = GlobalMicroAppsSerializer(global_apps, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, format=None):
        serializer = GlobalMicroAppsSerializer(data=request.data)
        if serializer.is_valid():
            globalapp = serializer.save()
            # self.add_assets(request=request, globalapp=globalapp)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class GlobalAppDetail(APIView):

    def get_object(self, pk):
        try:
            return GlobalMicroapps.objects.get(id=pk)
        except GlobalMicroapps.DoesNotExist:
            raise Http404
     
    def get(self, request, pk, format=None):
        snippet = self.get_object(pk)
        serializer = GlobalMicroAppsSerializer(snippet)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk, format=None):
        global_app = self.get_object(pk)
        serializer = GlobalMicroAppsSerializer(global_app, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk, format=None):
        global_app = self.get_object(pk)
        global_app.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
