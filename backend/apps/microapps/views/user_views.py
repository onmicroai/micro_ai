"""
User management views - User-microapp relationships and permissions.
"""
import logging as log
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.custom_permissions import IsOwner, AdminRole
from apps.microapps.models import MicroAppUserJoin, Microapp
from apps.microapps.serializer import MicroAppSerializer, MicroappUserSerializer
from apps.collection.models import Collection, CollectionUserJoin
from apps.collection.serializer import CollectionMicroappSerializer
from apps.users.models import CustomUser
from .mixins import handle_exception, UserPermissionMixin


@extend_schema_view(
    delete=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary="Delete user from a microapp"),
)
class UserMicroApps(APIView, UserPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get_object(self, uid, aid):
        """Get user-microapp relationship."""
        try:
            return MicroAppUserJoin.objects.get(user_id=uid, ma_id=aid)
        except Exception as e:
            return handle_exception(e)

    def delete(self, request, app_id, user_id, format=None):
        """Remove user from microapp."""
        try:
            self.permission_classes = [IsOwner]
            self.check_permissions(request)
            if user_id and user_id != request.user.id:
                userapp = self.get_object(user_id, app_id)
                if userapp:
                    userapp.delete()
                    return Response(status=status.HTTP_200_OK)
                return Response(
                    error.MICROAPP_NOT_EXIST,
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                error.INVALID_PAYLOAD,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    post=extend_schema(request=MicroappUserSerializer, responses={200: MicroappUserSerializer}, summary="Add user in a microapp"),
    put=extend_schema(request=MicroappUserSerializer, responses={201: MicroappUserSerializer}, summary="Update user role of a microapp"),
)
class UserMicroAppsDetails(APIView, UserPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get_object(self, uid, aid):
        """Get user-microapp relationship."""
        try:
            return MicroAppUserJoin.objects.get(user_id=uid, ma_id=aid)
        except Exception as e:
            return handle_exception(e)
        
    def get_user_shared_collection(self, uid, ma_id):
        """Add microapp to user's shared collection."""
        try:
            shared_collections = Collection.objects.filter(name="Shared With Me")

            collection_user_joins = CollectionUserJoin.objects.filter(collection_id__in=shared_collections, user_id=uid)
            collection_ids = collection_user_joins.values_list('collection_id', flat=True).first()
            data = {"collection_id": collection_ids, "ma_id": ma_id}
            serializer = CollectionMicroappSerializer(data=data)
            if serializer.is_valid():   
                serializer.save()
                return True
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)
        
    def post(self, request, format=None):
        """Add user to microapp."""
        try:
            self.permission_classes = [IsOwner, AdminRole]
            self.check_permissions(request)
            data = request.data
            self.get_user_shared_collection(data.get("user_id"), data.get("ma_id"))
            serializer = MicroappUserSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
)
class UserApps(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user's microapps."""
        try:
            current_user = request.user.id
            user_apps_ids = MicroAppUserJoin.objects.filter(user_id=current_user).values_list(
                "ma_id", flat=True
            )
            user_apps = Microapp.objects.filter(id__in=user_apps_ids)
            serializer = MicroAppSerializer(user_apps, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary="Get user role for a microapp using hash_id"),
)
class UserMicroAppsRoleByHash(APIView, UserPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get_microapp(self, hash_id):
        """Get microapp by hash ID."""
        try:
            return Microapp.objects.get(hash_id=hash_id)
        except Microapp.DoesNotExist:
            return None

    def get_objects(self, uid, hash_id):
        """Get user role for microapp by hash ID."""
        try:
            microapp = self.get_microapp(hash_id)
            if not microapp:
                return {"error": "No Microapp Found", "status": status.HTTP_404_NOT_FOUND}
            
            # Check if user exists
            if not CustomUser.objects.filter(id=uid).exists():
                return {"error": "No user with that uid", "status": status.HTTP_404_NOT_FOUND}
            
            # Get user role (may be empty if user has no role)
            user_role = MicroAppUserJoin.objects.filter(user_id=uid, ma_id=microapp.id)
            return {"data": user_role, "status": status.HTTP_200_OK}
            
        except Exception as e:
            return handle_exception(e)

    def get(self, request, hash_id, user_id):
        """Get user role for microapp by hash ID."""
        try:
            result = self.get_objects(user_id, hash_id)
            
            if "error" in result:
                return Response(result, status=result["status"])
                
            user_role = result["data"]
            serializer = MicroappUserSerializer(user_role, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
            
        except Exception as e:
            return handle_exception(e)
