"""
Microapp management views - CRUD operations for microapps.
"""
import json
import logging as log
from urllib.parse import urlparse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.custom_permissions import IsAdminOrOwner
from apps.utils.global_variables import MicroappVariables
from apps.microapps.models import Microapp, AppFileReference
from apps.microapps.serializer import (
    MicroAppSerializer,
    MicroappUserSerializer,
    MicroAppSwaggerPostSerializer,
    MicroAppSwaggerPutSerializer
)
from apps.collection.serializer import CollectionMicroappSerializer
from apps.utils.usage_helper import MicroAppUsage
from .mixins import handle_exception, MicroAppMixin


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary="Get all microapps on a platform"),
    post=extend_schema(request=MicroAppSwaggerPostSerializer, responses={200: MicroAppSerializer}, summary="Add microapp"),
)
class MicroAppList(APIView, MicroAppMixin):
    permission_classes = [IsAuthenticated]

    def add_microapp_user(self, uid, microapp, max_count):
        """Add user to microapp with specified role."""
        try:
            data = {"role": MicroappVariables.APP_OWNER, "ma_id": microapp.id, "user_id": uid, "counts_toward_max": max_count}
            serializer = MicroappUserSerializer(data=data)
            if serializer.is_valid():
                return serializer.save()
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)
    
    def add_collection_microapp(self, cid, microapp):
        """Add microapp to collection."""
        try:
            data = {"ma_id": microapp.id, "collection_id": cid}
            serializer = CollectionMicroappSerializer(data=data)
            if serializer.is_valid():
                return serializer.save()
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)

    def get(self, request, format=None):
        """Get all non-archived microapps."""
        try:
            micro_apps = Microapp.objects.filter(is_archived=False)
            serializer = MicroAppSerializer(micro_apps, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)

    def post(self, request, format=None):
        """Create a new microapp. collection_id is optional."""
        try:
            data = dict(request.data)
            cid = data.pop("collection_id", None)
            if cid is not None:
                if isinstance(cid, str) and cid.isdigit():
                    cid = int(cid)
                try:
                    cid = int(cid)
                except (TypeError, ValueError):
                    return Response(
                        error.validation_error({"collection_id": ["Invalid collection id."]}),
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if cid <= 0:
                    cid = None

            usage_info = MicroAppUsage.check_max_apps(request.user.id)
            if not usage_info["can_create"]:
                return Response(
                    error.microapp_usage_limit_exceed(usage_info["limit"], usage_info["current_count"]),
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer = MicroAppSerializer(data=data)
            if serializer.is_valid():
                microapp = serializer.save()
                self.add_microapp_user(uid=request.user.id, microapp=microapp, max_count=True)
                if cid is not None:
                    self.add_collection_microapp(cid, microapp)
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
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary="Get microapp by id"),
    put=extend_schema(request=MicroAppSwaggerPutSerializer, responses={200: MicroAppSerializer}, summary="Update by microapp"),
)
class MicroAppDetails(APIView, MicroAppMixin):
    permission_classes = [IsAuthenticated]

    def get(self, request, app_id, format=None):
        """Get microapp details by ID."""
        try:
            snippet = self.get_microapp(app_id)
            if snippet and not snippet.is_archived:
                # Check permissions if app is private
                if snippet.privacy == "private":
                    self.permission_classes = [IsAdminOrOwner]
                    self.check_permissions(request)
                
                serializer = MicroAppSerializer(snippet)
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                error.MICROAPP_NOT_EXIST,
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return handle_exception(e)

    def put(self, request, app_id, format=None):
        """Update microapp by ID."""
        try:
            self.permission_classes = [IsAdminOrOwner]
            self.check_permissions(request)
            micro_apps = self.get_microapp(app_id)
            if micro_apps:
                serializer = MicroAppSerializer(micro_apps, data=request.data)
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
                error.MICROAPP_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)

    def patch(self, request, app_id, format=None):
        """Partially update microapp fields by ID."""
        try:
            self.permission_classes = [IsAdminOrOwner]
            self.check_permissions(request)
            micro_apps = self.get_microapp(app_id)
            if micro_apps:
                serializer = MicroAppSerializer(micro_apps, data=request.data, partial=True)
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
                error.MICROAPP_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    delete=extend_schema(responses={200: {}}, summary="API doesn't delete the microapp, it just archives it"),
)
class MicroAppArchive(APIView, MicroAppMixin):
    permission_classes = [IsAuthenticated]

    def delete(self, request, app_id, format=None):
        """Archive a microapp."""
        microapp = self.get_microapp(app_id)
        if not microapp:
            return Response({'error': 'Microapp not found'}, status=status.HTTP_404_NOT_FOUND)

        # Toggle the is_archived status
        microapp.archive()

        return Response(
            {"data": {}, "status": status.HTTP_200_OK},
            status=status.HTTP_200_OK,
        )


class CloneMicroApp(APIView, MicroAppMixin):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, collection_id=None):
        """Clone a microapp. Optional collection_id adds the clone to that collection only."""
        try:
            microapp = self.get_microapp(pk)
            if not microapp:
                return Response(
                    error.MICROAPP_NOT_EXIST,
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Check if copying is allowed
            if not microapp.copy_allowed:
                return Response(
                    {"error": "Copying this microapp is not allowed.", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                )

            target_collection_id = collection_id if collection_id and collection_id > 0 else None

            usage_info = MicroAppUsage.check_max_apps(request.user.id)
            if usage_info["can_create"]:
                # Instead of using model_to_dict, use the serializer to get the data
                original_data = MicroAppSerializer(microapp).data
                # Remove the fields we don't want to copy
                original_data.pop('id', None)
                original_data.pop('hash_id', None)
                original_data['title'] = original_data['title'] + " copy"

                # Update the title in the app_json as well
                try:
                    app_json = original_data.get('app_json', '{}')
                    if isinstance(app_json, str):
                        app_json = json.loads(app_json)
                    if isinstance(app_json, dict):
                        app_json['title'] = original_data['title']
                        original_data['app_json'] = json.dumps(app_json)
                except Exception as e:
                    log.error(f"Error updating app_json title: {e}")
                
                serializer = MicroAppSerializer(data=original_data)
                if serializer.is_valid():
                    new_microapp = serializer.save()
                    micro_app_list = MicroAppList
                    micro_app_list.add_microapp_user(self, uid=request.user.id, microapp=new_microapp, max_count=True)

                    if target_collection_id:
                        micro_app_list.add_collection_microapp(self, target_collection_id, new_microapp)

                    # Copy RAG file references - cloned app shares the same chunks,
                    # no vector data is duplicated.
                    references = AppFileReference.objects.filter(app=microapp)
                    if references.exists():
                        AppFileReference.objects.bulk_create([
                            AppFileReference(app=new_microapp, file_source=ref.file_source)
                            for ref in references
                        ])

                    return Response(
                        {"data": MicroAppSerializer(new_microapp).data, "status": status.HTTP_200_OK},
                        status=status.HTTP_200_OK,
                    )
                return Response(
                    error.validation_error(serializer.errors),
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                error.MICROAPP_USAGE_LIMIT_EXCEED,
                status=status.HTTP_400_BAD_REQUEST,
            ) 
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary="Get microapp by hash_id"),
)
class MicroAppDetailsByHash(APIView, MicroAppMixin):
    permission_classes = [IsAuthenticated]

    def get(self, request, hash_id, format=None):
        """Get microapp details by hash ID."""
        try:
            snippet = self.get_microapp_by_hash(hash_id)
            if snippet and not snippet.is_archived:
                # Full serializer (incl. app_json) is only for owners/admins on this
                # authenticated endpoint — public runtime uses PublicMicroAppsByHash.
                self.permission_classes = [IsAdminOrOwner]
                self.check_permissions(request)

                serializer = MicroAppSerializer(snippet)
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                error.MICROAPP_NOT_EXIST,
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary="Get microapp by id without authentication")
)
class PublicMicroApps(APIView, MicroAppMixin):
    permission_classes = [AllowAny]
    
    def get(self, request, id):
        """Get public microapp by ID."""
        try:
            microapp = self.get_microapp(id)    
            serializer = MicroAppSerializer(microapp)
            if serializer.data["privacy"] != "public":
                return Response({"error": "The App is not public", "status": status.HTTP_403_FORBIDDEN}, status=status.HTTP_403_FORBIDDEN)
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary="Get microapp by hash_id without authentication")
)
class PublicMicroAppsByHash(APIView, MicroAppMixin):
    permission_classes = [AllowAny]

    def get(self, request, hash_id):
        """Get public microapp by hash ID. Restricted apps allowed when embed_origin is in permitted_domains."""
        try:
            microapp = self.get_microapp_by_hash(hash_id)
            serializer = MicroAppSerializer(microapp)
            privacy = serializer.data.get("privacy", "")

            if privacy == "public":
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )

            if privacy == "restricted":
                embed_origin = request.query_params.get("embed_origin", "")
                host = _normalize_domain_for_check(embed_origin)
                permitted = microapp.permitted_domains or []
                if isinstance(permitted, list) and host:
                    permitted_normalized = [
                        str(d).lower().strip() for d in permitted if d
                    ]
                    embed_allowed = host in permitted_normalized or any(
                        host == d or host.endswith("." + d)
                        for d in permitted_normalized
                    )
                    if embed_allowed:
                        return Response(
                            {"data": serializer.data, "status": status.HTTP_200_OK},
                            status=status.HTTP_200_OK,
                        )

            return Response(
                {"error": "The App is not public", "status": status.HTTP_403_FORBIDDEN},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception as e:
            return handle_exception(e)


def _normalize_domain_for_check(embed_origin: str):
    """Extract hostname from URL for domain comparison. Returns None if invalid."""
    if not embed_origin or not isinstance(embed_origin, str):
        return None
    try:
        parsed = urlparse(embed_origin)
        host = (parsed.netloc or parsed.path).split(":")[0].lower().strip()
        return host if host else None
    except Exception:
        return None


@extend_schema_view(
    get=extend_schema(responses={200: dict}, summary="Get app's visibility status by hash_id")
)
class MicroAppVisibility(APIView, MicroAppMixin):
    permission_classes = [AllowAny]

    def get(self, request, hash_id):
        """Check if microapp is public and whether embed is allowed from the given origin."""
        try:
            microapp = self.get_microapp_by_hash(hash_id)
            is_public = microapp.privacy == "public"

            # For embed: public allows anywhere; restricted allows only permitted domains
            embed_allowed = False
            if microapp.privacy == "public":
                embed_allowed = True
            elif microapp.privacy == "restricted":
                embed_origin = request.query_params.get("embed_origin", "")
                host = _normalize_domain_for_check(embed_origin)
                permitted = microapp.permitted_domains or []
                if isinstance(permitted, list) and host:
                    # Check exact match; optionally support subdomain (e.g. blog.example.com when example.com is permitted)
                    permitted_normalized = [str(d).lower().strip() for d in permitted if d]
                    embed_allowed = host in permitted_normalized or any(
                        host == d or host.endswith("." + d) for d in permitted_normalized
                    )

            return Response({
                "data": {
                    "isPublic": is_public,
                    "embedAllowed": embed_allowed,
                },
                "status": status.HTTP_200_OK
            }, status=status.HTTP_200_OK)

        except Exception:
            return Response({
                "data": {"isPublic": False, "embedAllowed": False},
                "status": status.HTTP_200_OK
            }, status=status.HTTP_200_OK)
