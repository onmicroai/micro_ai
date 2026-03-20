from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
import logging as log
from rest_framework.permissions import IsAuthenticated
from apps.collection.models import Collection, CollectionMaJoin, CollectionUserJoin
from .serializer import CollectionSerializer, CollectionMicroappSerializer, CollectionUserSerializer, CollectionMicroAppSwaggerGetSerializer
from apps.microapps.models import Microapp, MicroAppUserJoin
from apps.microapps.serializer import MicroAppSerializer
from apps.microapps.views.analytics_views import get_stats_for_app_ids
from drf_spectacular.utils import extend_schema, extend_schema_view
from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.custom_permissions import IsCollectionAdmin
from rest_framework.exceptions import PermissionDenied

def handle_exception(e):
    log.error(e)
    return Response(
        error.SERVER_ERROR,
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
    
    def get(self, request, format=None):
        try:
            collections = Collection.objects.all()
            serializer = CollectionSerializer(collections, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)

    def post(self, request, format=None):
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
                error.validation_error(serializer.errors),
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
    
    def get(self, request, collection_id, format=None):
        try:
            collection = self.get_object(collection_id)
            if collection:
                serializer = CollectionSerializer(collection)
                return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            ) 
            return Response(
                error.COLLECTION_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)

    def put(self, request, collection_id, format=None):
        try:
            self.permission_classes = [IsCollectionAdmin]
            self.check_permissions(request)
            collection = self.get_object(collection_id)
            if collection:
                serializer = CollectionSerializer(collection, data=request.data)
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
            return Response(
                error.COLLECTION_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
            ) 
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

    def delete(self, request, collection_id, format=None):
        try:
            self.permission_classes = [IsCollectionAdmin]
            self.check_permissions(request)
            collection = self.get_object(collection_id)
            if collection:
                collection.delete()
                return Response(status=status.HTTP_200_OK)
            return Response(
                error.COLLECTION_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(request=CollectionSerializer, responses={200: CollectionSerializer}, summary= "Get all user collections on an app"),
    post=extend_schema(request=CollectionUserSerializer, responses={200: CollectionUserSerializer}, summary= "Add user in a collection"),
)
class UserCollections(APIView):
    permission_classes=[IsAuthenticated]

    def get(self, request, format=None):
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
        
    def post(self, request, format=None):
        try:
            self.permission_classes=[IsCollectionAdmin]
            self.check_permissions(request)
            data = request.data
            serializer = CollectionUserSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response({"data": serializer.data, "status": status.HTTP_200_OK}, 
                    status=status.HTTP_200_OK)
            return Response(error.validation_error(serializer.errors), 
                    status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    delete=extend_schema(request=CollectionUserSerializer, responses={200: CollectionUserSerializer}, summary= "Delete user from a collection by collection-id and user-id"),
)
class UserCollectionsDetail(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, collection_id, user_id, format=None):
        try:
            self.permission_classes = [IsCollectionAdmin]
            self.check_permissions(request)
            collection_user = CollectionUserJoin.objects.get(collection_id=collection_id, user_id=user_id)
            if collection_user:
                collection_user.delete()
                return Response(status=status.HTTP_200_OK)
            return Response(
                error.USER_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)  

@extend_schema_view(
    get=extend_schema(request=MicroAppSerializer, responses={200: MicroAppSerializer}, summary= "Get all microapps of a collection"),
)  
class CollectionMicroAppsList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id, format=None):
        try:
            current_user = request.user.id
            if not CollectionUserJoin.objects.filter(collection_id = collection_id, user_id = current_user).exists():
                return Response(error.COLLECTION_VIEW_FORBIDDEN, status = status.HTTP_403_FORBIDDEN)
            microapps = Microapp.objects.filter(collectionmajoin__collection_id=collection_id, is_archived=False)
            serializer = MicroAppSerializer(microapps, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )  
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(request=MicroAppSerializer, responses={200: MicroAppSerializer}, summary="Get microapps created by user of a collection"),
)
class UserCollectionMicroAppsList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id, format=None):
        try:
            current_user = request.user
            
            # Check if the user has access to the collection
            if not CollectionUserJoin.objects.filter(collection_id=collection_id, user_id=current_user).exists():
                return Response({"error": "You do not have permission to view this collection."}, status=status.HTTP_403_FORBIDDEN)

            # Get micro-app IDs associated with the collection
            ma_ids = CollectionMaJoin.objects.filter(collection_id=collection_id).values_list(
                "ma_id", flat=True
            )

            # Filter out micro-apps where user has access and not archived
            collection_ma = Microapp.objects.filter(id__in=ma_ids, microappuserjoin__user_id=current_user, is_archived=False)
            app_ids = list(collection_ma.values_list('id', flat=True))
            stats_by_id = get_stats_for_app_ids(app_ids)
            role_by_id = dict(
                MicroAppUserJoin.objects.filter(
                    ma_id__in=app_ids, user_id=current_user
                ).values_list('ma_id', 'role')
            )
            data = MicroAppSerializer(collection_ma, many=True).data
            default_stats = {'sessions': 0, 'unique_users': 0, 'total_credits': 0, 'avg_credits_session': 0}
            for item in data:
                item['stats'] = stats_by_id.get(item['id'], default_stats)
                item['role'] = role_by_id.get(item['id'], 'owner')

            return Response(
                {"data": data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    post=extend_schema(request=CollectionMicroappSerializer, responses={200: CollectionMicroappSerializer}, summary="Add microapp in a collection"),
    delete=extend_schema(request=CollectionMicroappSerializer, responses={200: CollectionMicroappSerializer}, summary="Delete microapp from a collection"),
    put=extend_schema(request=CollectionMicroappSerializer, responses={200: CollectionMicroappSerializer}, summary="Move microapp to a different collection"),
)  
class CollectionMicroAppsDetails(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, collection_id, app_id, format=None):
        try:
            self.permission_classes = [IsCollectionAdmin]
            self.check_permissions(request)
            data = {"ma_id": app_id, "collection_id": collection_id}
            serializer = CollectionMicroappSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response({"data": serializer.data, "status": status.HTTP_200_OK},status=status.HTTP_200_OK,)  
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)
    
    def delete(self, request, collection_id, app_id, format=None):
        try:
            self.permission_classes = [IsCollectionAdmin]
            self.check_permissions(request)
            collection = CollectionMaJoin.objects.get(collection_id=collection_id,ma_id=app_id)
            if collection:
                collection.delete()
                return Response(status=status.HTTP_200_OK)
            return Response(
                error.COLLECTION_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN) 
        except Exception as e:
            return handle_exception(e)

    def put(self, request, collection_id, app_id, format=None):
        try:
            self.permission_classes = [IsCollectionAdmin]
            self.check_permissions(request)
            
            # Get the old collection-app join
            old_collection = CollectionMaJoin.objects.filter(ma_id=app_id).first()
            
            # Create new collection-app join
            data = {"ma_id": app_id, "collection_id": collection_id}
            serializer = CollectionMicroappSerializer(data=data)
            
            if serializer.is_valid():
                # If there was an old collection, delete it
                if old_collection:
                    old_collection.delete()
                
                # Save the new collection
                serializer.save()
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK
                )
            
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST
            )
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(responses={200: CollectionSerializer(many=True)}, summary="Get collections for a specific app (user-scoped: only collections the current user has access to)"),
)
class AppCollectionsList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, app_id, format=None):
        try:
            current_user = request.user.id
            # Collections this app is in (from join table)
            collection_ids_for_app = CollectionMaJoin.objects.filter(ma_id=app_id).values_list(
                "collection_id", flat=True
            )
            # Restrict to collections the current user has access to (CollectionUserJoin)
            user_collection_ids = CollectionUserJoin.objects.filter(
                user_id=current_user
            ).values_list("collection_id", flat=True)
            # Intersection: app's collections that the user can see
            allowed_ids = set(collection_ids_for_app) & set(user_collection_ids)
            app_collections = Collection.objects.filter(id__in=allowed_ids).order_by("id")
            serializer = CollectionSerializer(app_collections, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(responses={200: CollectionMicroAppSwaggerGetSerializer(many=True)}, summary="Get Collection and their Associated Microapps"),
)
class CollectionMicroApps(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, format = None):
        try:
            user_id = request.user.id    
            collections = Collection.objects.filter(collectionuserjoin__user_id=user_id)
            response = []
            for collection in collections:
                microapps = Microapp.objects.filter(collectionmajoin__collection_id=collection.id, is_archived=False)
                serializer = MicroAppSerializer(microapps, many=True)
                response.append({
                    'collection_id': collection.id,
                    'collection_name': collection.name,  
                    'microapps': serializer.data
                })
            return Response({"data": response, "status": status.HTTP_200_OK}, status = status.HTTP_200_OK)

        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(responses={200: CollectionSerializer(many=True)}, summary="Get all collections where the user has ADMIN role"),
)
class UserCollectionsAdmin(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        try:
            user = request.user.id
            admin_collection_ids = CollectionUserJoin.objects.filter(
                user_id=user, 
                role=CollectionUserJoin.ADMIN
            ).values_list("collection_id", flat=True)
            
            admin_collections = Collection.objects.filter(id__in=admin_collection_ids)
            serializer = CollectionSerializer(admin_collections, many=True)
            
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)
