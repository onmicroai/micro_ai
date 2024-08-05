from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
import logging as log
from rest_framework.permissions import IsAuthenticated
from apps.collection.models import Collection, CollectionMaJoin, CollectionUserJoin
from .serializer import CollectionSerializer, CollectionMicroappSerializer, CollectionUserSerializer
from apps.microapps.models import Microapp
from apps.microapps.serializer import MicroAppSerializer
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter

def handle_exception(e):
    log.error(e)
    return Response(
        {"error": "an unexpected error occurred", "status": status.HTTP_500_INTERNAL_SERVER_ERROR},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

@extend_schema_view(
    get=extend_schema(responses={200: CollectionSerializer(many=True)}, summary="Get all collection on platform"),
    post=extend_schema(request=CollectionSerializer, responses={200: CollectionSerializer}, summary= "Create a new user collection"),
)
class CollectionList(APIView):
    permission_classes = [IsAuthenticated]

    def add_collection_user(self, uid, cid):
        try:
            data = {"collection_id": cid, "user_id": uid, "role": "admin"}
            serializer = CollectionUserSerializer(data=data)
            if serializer.is_valid():
                serialize= serializer.save()
                return serialize
            return None
        except Exception as e:
            return handle_exception(e)
    
    def add_collection_microapp():
        try:
            pass
        except Exception as e:
            return handle_exception(e)

    def get(self,request,format=None):
        try:
            collections = Collection.objects.all()
            serializer = CollectionSerializer(collections, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)

    def post(self,request,format=None):
        try:
            user = request.user.id
            serializer = CollectionSerializer(data=request.data)
            if serializer.is_valid():
                serialize = serializer.save()
                self.add_collection_user(user, serialize.id)
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": serialize.errors, "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)
        
@extend_schema_view(
    get=extend_schema(request=CollectionSerializer, responses={200: CollectionSerializer}, summary="Get user collection by id"),
    put=extend_schema(request=CollectionSerializer, responses={200: CollectionSerializer}, summary="Update user collection name by id"),
    delete=extend_schema(request=CollectionSerializer, responses={200: CollectionSerializer}, summary="Delete user collection by id"),
)
class CollectionDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Collection.objects.get(id=pk)
        except Collection.DoesNotExist:
            return None
    
    def get(self,request,pk,format=None):
        try:
            collection = self.get_object(pk)
            if collection:
                serializer = CollectionSerializer(collection)
                return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            ) 
            return Response(
                {"error": "collection not exist", "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)

    def put(self,request,pk,format=None):
        try:
            user = request.user.id
            user_role = CollectionUserJoin.objects.filter(user_id=user, collection_id=pk).values_list(
                "role", flat=True
            )
            if "admin" in user_role:
                collection = self.get_object(pk)
                if collection:
                    serializer = CollectionSerializer(collection, data=request.data)
                    if serializer.is_valid():
                        serializer.save()
                        return Response(
                            {"data": serializer.data, "status": status.HTTP_200_OK},
                            status=status.HTTP_200_OK,
                        )
                    return Response(
                        {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                return Response(
                    {"error": "collection not exist", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                ) 
            return Response(
                    {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Exception as e:
            return handle_exception(e)

    def delete(self,request,pk,format=None):
        try:
            user = request.user.id
            user_role = CollectionUserJoin.objects.filter(user_id=user, collection_id=pk).values_list(
                "role", flat=True
            )
            if "admin" in user_role:
                collection = self.get_object(pk)
                if collection:
                    collection.delete()
                    return Response(status=status.HTTP_200_OK)
                return Response(
                    {"error": "collection not exist", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                    {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(request=CollectionSerializer, responses={200: CollectionSerializer}, summary= "Get all user collections on an app"),
    post=extend_schema(request=CollectionUserSerializer, responses={200: CollectionUserSerializer}, summary= "Add user in a collection"),
)
class UserCollections(APIView):
    permission_classe=[IsAuthenticated]

    def get(self,request,format=None):
        try:
            user = request.user.id
            collection_ids = CollectionUserJoin.objects.filter(user_id=user).values_list(
                "collection_id", flat=True
            )
            user_apps = Collection.objects.filter(id__in=collection_ids)
            serializer = CollectionSerializer(user_apps, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            ) 
        except Exception as e:
            return handle_exception(e)
        
    def post(self,request,format=None):
        try:
            user = request.user.id
            data = request.data
            user_role = CollectionUserJoin.objects.filter(collection_id=data.get("collection_id"), user_id=user).values_list(
                "role", flat=True
            )
            if "admin" in user_role:
                serializer = CollectionUserSerializer(data=data)
                if serializer.is_valid():
                    serializer.save()
                    return Response({"data": serializer.data, "status": status.HTTP_200_OK}, 
                        status=status.HTTP_200_OK)
                return Response({"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}, 
                        status=status.HTTP_400_BAD_REQUEST)
            return Response(
                        {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                        status=status.HTTP_403_FORBIDDEN,)
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    delete=extend_schema(request=CollectionUserSerializer, responses={200: CollectionUserSerializer}, summary= "Delete user from a collection by collection-id and user-id"),
)
class UserCollectionsDetail(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self,request,collection_id,user_id,format=None):
        try:
            user = request.user.id
            data = request.data
            user_role = CollectionUserJoin.objects.filter(collection_id=collection_id, user_id=user).values_list(
                "role", flat=True
            )
            if "admin" in user_role:
                collection_user = CollectionUserJoin.objects.get(collection_id=collection_id, user_id=user_id)
                if collection_user:
                    collection_user.delete()
                    return Response(status=status.HTTP_200_OK)
                return Response(
                    {"error": "collection not exist", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                    {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                ) 
        except Exception as e:
            return handle_exception(e)  

@extend_schema_view(
    get=extend_schema(request=MicroAppSerializer, responses={200: MicroAppSerializer}, summary= "Get all microapps of a collection"),
)  
class CollectionMicroAppsList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self,request,collection_id,format=None):
        try:
            ma_ids = CollectionMaJoin.objects.filter(collection_id=collection_id).values_list(
                "ma_id", flat=True
            )
            collection_ma = Microapp.objects.filter(id__in=ma_ids)
            serializer = MicroAppSerializer(collection_ma, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )  
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    post=extend_schema(request=CollectionMicroappSerializer, responses={200: CollectionMicroappSerializer}, summary="Add microapp in a collection"),
    delete=extend_schema(request=CollectionMicroappSerializer, responses={200: CollectionMicroappSerializer}, summary="Delete microapp from a collection"),
)  
class CollectionMicroAppsDetails(APIView):
    permission_classes = [IsAuthenticated]

    def post(self,request,collection_id,app_id,format=None):
        try:
            user = request.user.id
            user_role = CollectionUserJoin.objects.filter(collection_id=collection_id, user_id=user).values_list(
                "role", flat=True
            )
            if "admin" in user_role:
                data = {"ma_id": app_id, "collection_id": collection_id}
                serializer = CollectionMicroappSerializer(data=data)
                if serializer.is_valid():
                    serializer.save()
                    return Response({"data": serializer.data, "status": status.HTTP_200_OK},status=status.HTTP_200_OK,)  
                return Response(
                    {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                    {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Exception as e:
            return handle_exception(e)
    
    def delete(self,request,collection_id,app_id,format=None):
        try:
            user = request.user.id
            user_role = CollectionUserJoin.objects.filter(collection_id=collection_id, user_id=user).values_list(
                "role", flat=True
            )
            if "admin" in user_role:
                collection = CollectionMaJoin.objects.get(collection_id=collection_id,ma_id=app_id)
                if collection:
                    collection.delete()
                    return Response(status=status.HTTP_200_OK)
                return Response(
                    {"error": "collection not exist", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                    {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                ) 
        except Exception as e:
            return handle_exception(e)
    