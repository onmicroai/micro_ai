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
from apps.utils.throttles import AddAdminThrottle
from apps.microapps.models import MicroAppUserJoin, Microapp
from apps.microapps.serializer import MicroAppSerializer, MicroappUserSerializer
from apps.collection.models import Collection, CollectionUserJoin
from apps.collection.serializer import CollectionMicroappSerializer
from apps.users.models import CustomUser
from .mixins import handle_exception, UserPermissionMixin
from .analytics_views import get_stats_for_app_ids


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
        """Get user's microapps with their role and stats."""
        try:
            current_user = request.user.id
            joins = MicroAppUserJoin.objects.filter(
                user_id=current_user, is_archived=False
            ).select_related('ma_id')
            app_ids = [join.ma_id.id for join in joins]
            stats_by_id = get_stats_for_app_ids(app_ids)
            result = []
            for join in joins:
                app_data = MicroAppSerializer(join.ma_id).data
                app_data['role'] = join.role
                app_data['stats'] = stats_by_id.get(join.ma_id.id, {
                    'sessions': 0, 'unique_users': 0, 'total_credits': 0, 'avg_credits_session': 0
                })
                result.append(app_data)
            return Response(
                {"data": result, "status": status.HTTP_200_OK},
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


class AppAdminsView(APIView, UserPermissionMixin):
    """Manage admin users for a microapp (owner-only)."""
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        """Only throttle POST (email lookup) to prevent user enumeration abuse."""
        if self.request.method == 'POST':
            self._admin_throttle = AddAdminThrottle()
            return [self._admin_throttle]
        return []

    def _get_app_or_404(self, app_id):
        try:
            return Microapp.objects.get(id=app_id)
        except Microapp.DoesNotExist:
            return None

    def _check_is_owner(self, request, app_id):
        return MicroAppUserJoin.objects.filter(
            user_id=request.user.id, ma_id=app_id, role=MicroAppUserJoin.OWNER
        ).exists()

    def _check_is_owner_or_admin(self, request, app_id):
        return MicroAppUserJoin.objects.filter(
            user_id=request.user.id, ma_id=app_id, role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN]
        ).exists()

    def _add_to_shared_collection(self, user_id, ma_id):
        """Add the microapp to the target user's 'Shared With Me' collection."""
        try:
            shared_collections = Collection.objects.filter(name="Shared With Me")
            collection_id = CollectionUserJoin.objects.filter(
                collection_id__in=shared_collections, user_id=user_id
            ).values_list('collection_id', flat=True).first()
            if collection_id:
                data = {"collection_id": collection_id, "ma_id": ma_id}
                serializer = CollectionMicroappSerializer(data=data)
                if serializer.is_valid():
                    serializer.save()
        except Exception as e:
            log.error(f"Could not add app to shared collection: {e}")

    def get(self, request, app_id):
        """List the owner and all admins for the app."""
        try:
            if not self._check_is_owner_or_admin(request, app_id):
                return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

            joins = MicroAppUserJoin.objects.filter(
                ma_id=app_id, role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN]
            ).select_related('user_id')

            role_order = {MicroAppUserJoin.OWNER: 0, MicroAppUserJoin.ADMIN: 1}
            sorted_joins = sorted(joins, key=lambda j: role_order.get(j.role, 2))

            people = [
                {
                    "id": j.user_id.id,
                    "email": j.user_id.email,
                    "first_name": j.user_id.first_name,
                    "last_name": j.user_id.last_name,
                    "role": j.role,
                }
                for j in sorted_joins
            ]
            return Response({"data": people, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        except Exception as e:
            return handle_exception(e)

    def post(self, request, app_id):
        """Add a user as admin by email address."""
        try:
            if not self._check_is_owner(request, app_id):
                return Response({"error": "Permission denied. Only the owner can add admins."}, status=status.HTTP_403_FORBIDDEN)

            app = self._get_app_or_404(app_id)
            if not app:
                return Response({"error": "App not found."}, status=status.HTTP_404_NOT_FOUND)

            email = request.data.get("email", "").strip().lower()
            if not email:
                return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                target_user = CustomUser.objects.get(email__iexact=email)
            except CustomUser.DoesNotExist:
                # Only failed lookups count against the throttle limit.
                if hasattr(self, '_admin_throttle'):
                    self._admin_throttle.record_failed_attempt()
                return Response(
                    {"error": "No account found with that email address."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Prevent adding self
            if target_user.id == request.user.id:
                return Response(
                    {"error": "You are already the owner of this app."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if the user already has any role on this app
            existing = MicroAppUserJoin.objects.filter(user_id=target_user.id, ma_id=app_id).first()
            if existing:
                return Response(
                    {"error": "This user already has access to the app."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Enforce admin cap
            admin_count = MicroAppUserJoin.objects.filter(
                ma_id=app_id, role=MicroAppUserJoin.ADMIN
            ).count()
            if admin_count >= 25:
                return Response(
                    {"error": "This app has reached the maximum of 25 admins."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            MicroAppUserJoin.objects.create(
                ma_id=app,
                user_id=target_user,
                role=MicroAppUserJoin.ADMIN,
                counts_toward_max=False,
            )
            self._add_to_shared_collection(target_user.id, app_id)

            return Response(
                {
                    "data": {
                        "id": target_user.id,
                        "email": target_user.email,
                        "first_name": target_user.first_name,
                        "last_name": target_user.last_name,
                    },
                    "status": status.HTTP_201_CREATED,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return handle_exception(e)

    def delete(self, request, app_id, user_id):
        """Remove an admin from the app. Owners can remove any admin; admins can remove themselves."""
        try:
            is_owner = self._check_is_owner(request, app_id)
            is_self_removal = request.user.id == user_id

            if not is_owner and not is_self_removal:
                return Response(
                    {"error": "Permission denied."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            join = MicroAppUserJoin.objects.filter(
                ma_id=app_id, user_id=user_id, role=MicroAppUserJoin.ADMIN
            ).first()
            if not join:
                return Response({"error": "Admin not found."}, status=status.HTTP_404_NOT_FOUND)

            join.delete()
            return Response(status=status.HTTP_200_OK)
        except Exception as e:
            return handle_exception(e)
