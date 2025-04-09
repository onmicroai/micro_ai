import datetime
import re
import uuid
import os
from pathlib import Path
import environ
import logging as log
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework.permissions import IsAuthenticated, AllowAny 
from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.custom_permissions import (
    IsAdminOrOwner,
    IsOwner,
    AdminRole
)
from apps.users.models import CustomUser
from apps.microapps.serializer import (
    MicroAppSerializer,
    MicroappUserSerializer,
    MicroAppSwaggerPostSerializer,
    MicroAppSwaggerPutSerializer,
    RunPostSerializer,
    RunGetSerializer,
    RunPatchSerializer
)
from apps.users.serializers import UserSerializer
from apps.utils.usage_helper import RunUsage, MicroAppUsage, GuestUsage, get_user_ip
from apps.utils.global_variables import AIModelConstants, MicroappVariables
from apps.microapps.models import Microapp, MicroAppUserJoin, Run
from apps.microapps.document_parser import DocumentParser, DocumentProcessor
from apps.collection.models import Collection, CollectionUserJoin
from apps.collection.serializer import CollectionMicroappSerializer
from rest_framework.exceptions import PermissionDenied
from rest_framework import generics
from django.db.models import Min, Case, When, Count, F, Sum, Value, FloatField, Q, ExpressionWrapper, IntegerField

from django.db.models.functions import Round
from apps.subscriptions.models import BillingCycle, TopUpToSubscription
from apps.subscriptions.serializers import UsageEventSerializer, BillingDetailsSerializer
from django.utils import timezone
import stripe
import boto3
from botocore.config import Config
from rest_framework import serializers
from rest_framework.decorators import action
from django.conf import settings
import json
from .llm_interface import UnifiedLLMInterface
import tempfile

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))

class ImageUploadSerializer(serializers.Serializer):
    filename = serializers.CharField()
    content_type = serializers.CharField()

class PresignedUrlResponse(serializers.Serializer):
    url = serializers.CharField()
    fields = serializers.DictField()

class FileUploadSerializer(serializers.Serializer):
    filename = serializers.CharField()
    content_type = serializers.CharField()
    file_type = serializers.CharField(required=False)

def handle_exception(e):
    log.error(e)
    return Response(
        error.SERVER_ERROR,
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary = "Get all microapps on a platform"),
    post=extend_schema(request=MicroAppSwaggerPostSerializer, responses={200: MicroAppSerializer}, summary = "Add microapp"),
)
class MicroAppList(APIView):
    permission_classes = [IsAuthenticated]

    def add_microapp_user(self, uid, microapp, max_count):
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
        try:
            data = request.data
            cid = data.get("collection_id")
            if (cid is not None and isinstance(cid, int)):
                usage_info = MicroAppUsage.check_max_apps(request.user.id)
                if usage_info["can_create"]:
                    serializer = MicroAppSerializer(data=data)
                    if serializer.is_valid():
                        microapp = serializer.save()
                        self.add_microapp_user(uid=request.user.id, microapp=microapp, max_count = True)
                        self.add_collection_microapp(cid,microapp)
                        return Response(
                            {"data": serializer.data, "status": status.HTTP_200_OK},
                            status=status.HTTP_200_OK,
                        )
                    return Response(
                        error.validation_error(serializer.errors),
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                return Response(
                    error.microapp_usage_limit_exceed(usage_info["limit"], usage_info["current_count"]),
                    status = status.HTTP_400_BAD_REQUEST
                )
            return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary = "Get microapp by id"),
    put=extend_schema(request=MicroAppSwaggerPutSerializer, responses={200: MicroAppSerializer}, summary = "Update by microapp"),
)
class MicroAppDetails(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Microapp.objects.get(id=pk)
        except Microapp.DoesNotExist:
            return None

    def get(self, request, app_id, format=None):
        try:
            snippet = self.get_object(app_id)
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
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

    def put(self, request, app_id, format=None):
        try:
            self.permission_classes = [IsAdminOrOwner]
            self.check_permissions(request)
            micro_apps = self.get_object(app_id)
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
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

    # def delete(self, request, app_id, format=None):
    #     try:
    #         self.permission_classes = [IsOwner]
    #         self.check_permissions(request)
    #         micro_apps = self.get_object(app_id)
    #         if micro_apps:
    #             micro_apps.delete()
    #             return Response(status=status.HTTP_200_OK)
    #         return Response(error.MICROAPP_NOT_EXIST, status=status.HTTP_400_BAD_REQUEST)
        
    #     except PermissionDenied:
    #         return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
    #     except Exception as e:
    #         return handle_exception(e)

@extend_schema_view(
    delete=extend_schema(responses={200: {}}, summary= "API doesn't delete the microapp, it just archives it"),
)
class MicroAppArchive(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, app_id):
        try:
            return Microapp.objects.get(id=app_id)
        except Microapp.DoesNotExist:
            return None

    def delete(self, request, app_id, format=None):
        microapp = self.get_object(app_id)
        if not microapp:
            return Response({'error': 'Microapp not found'}, status=status.HTTP_404_NOT_FOUND)

        # Toggle the is_archived status
        microapp.archive()

        return Response(
                {"data": {}, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )

class CloneMicroApp(APIView):
    permission_classes = [IsAuthenticated]

    def get_microapp(self, pk):
        try:
            return Microapp.objects.get(id=pk)
        except Microapp.DoesNotExist:
            return None

    def get_or_create_default_collection(self, user_id):
        try:
            # First try to get user's collections
            user_collections = Collection.objects.filter(
                collectionuserjoin__user_id=user_id
            ).first()

            if user_collections:
                return user_collections

            # If no collections exist, create a default one
            default_collection = Collection.objects.create(
                name="My Apps",
                description="Your personal collection of apps"
            )
            # Add user as admin of the collection
            CollectionUserJoin.objects.create(
                collection_id=default_collection.id,
                user_id=user_id,
                role="admin"
            )
            return default_collection
        except Exception as e:
            log.error(f"Error getting/creating default collection: {e}")
            return None

    def post(self, request, pk, collection_id=None):
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

            # If collection_id is 0 or None, get or create a default collection
            target_collection_id = collection_id if collection_id and collection_id > 0 else None
            if not target_collection_id:
                default_collection = self.get_or_create_default_collection(request.user.id)
                if not default_collection:
                    return Response(
                        {"error": "Could not find or create a default collection.", "status": status.HTTP_400_BAD_REQUEST},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                target_collection_id = default_collection.id

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
                    micro_app_list.add_microapp_user(self, uid=request.user.id, microapp=new_microapp, max_count = True)
                    micro_app_list.add_collection_microapp(self, target_collection_id, new_microapp)
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
    # get=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary="Get user role for a microapp"),
    delete=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary= "Delete user from a microapp"),
)
class UserMicroApps(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, uid, aid):
        try:
            return MicroAppUserJoin.objects.get(user_id=uid, ma_id=aid)
        except Exception as e:
            return handle_exception(e)

    # def get_objects(self, uid, aid):
    #     try:
    #         return MicroAppUserJoin.objects.filter(user_id=uid, ma_id=aid)
    #     except Exception as e:
    #         return handle_exception(e)

    # def get(self, request, app_id, user_id=None):
    #     try:
    #         if user_id:
    #             user_role = self.get_objects(user_id, app_id)
    #             if user_role:
    #                 serializer = MicroappUserSerializer(user_role, many=True)
    #                 return Response(
    #                     {"data": serializer.data, "status": status.HTTP_200_OK},
    #                     status=status.HTTP_200_OK,
    #                 )
    #             return Response(
    #                 error.USER_NOT_EXIST,
    #                 status=status.HTTP_400_BAD_REQUEST,
    #             )
    #     except Exception as e:
    #         return handle_exception(e)

    def delete(self, request, app_id, user_id, format=None):
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
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)
        
@extend_schema_view(
    post=extend_schema(request=MicroappUserSerializer, responses={200: MicroappUserSerializer}, summary="Add user in a microapp"),
    put=extend_schema(request=MicroappUserSerializer, responses={201: MicroappUserSerializer}, summary= "Update user role of a microapp"),
)
class UserMicroAppsDetails(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, uid, aid):
        try:
            return MicroAppUserJoin.objects.get(user_id=uid, ma_id=aid)
        except Exception as e:
            return handle_exception(e)
        
    def get_user_shared_collection(self, uid, ma_id):
        try:
            shared_collections = Collection.objects.filter(name="Shared With Me")

            collection_user_joins = CollectionUserJoin.objects.filter(collection_id__in=shared_collections,user_id=uid)
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
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

# @extend_schema_view(
#     get=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary="Get all users role for a microapp"),
# )
# class UserMicroAppList(generics.ListAPIView):
#     serializer_class = MicroappUserSerializer
#     permission_classes = [IsAuthenticated]

#     def get_queryset(self):
#         try:
#             app_id = self.kwargs['app_id']
#             return MicroAppUserJoin.objects.filter(ma_id=app_id)
#         except Exception as e:
#             return handle_exception(e)
            
@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
)
class UserApps(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
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
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}), summary="Get microapp by id without authentication"
)
class PublicMicroApps(APIView):
    permission_classes = [AllowAny]
    def get(self, request, id):
        try:
            microapp = Microapp.objects.get(id = id)    
            serializer = MicroAppSerializer(microapp)
            if serializer.data["privacy"] != "public":
                return Response({"error": "The App is not public", "status": status.HTTP_403_FORBIDDEN}, status = status.HTTP_403_FORBIDDEN)
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status = status.HTTP_200_OK)
        
        except Microapp.DoesNotExist:
            return Response(error.MICROAPP_NOT_EXIST, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(
        responses={200: RunGetSerializer(many=True)},
        parameters=[
            OpenApiParameter(name="ma_id", description="Optional Micro App ID", required=False),
            OpenApiParameter(name="user_id", description="Optional User ID", required=False),
            OpenApiParameter(name="session_id", description="Optional Session ID", required=False),
            OpenApiParameter(name="start_date", description="Optional Start Date", required=False),
            OpenApiParameter(name="end_date", description="Optional End Date", required=False),
        ],
    ),
    post=extend_schema(request = RunPostSerializer, responses={200: RunGetSerializer}),
    patch=extend_schema(request = RunPatchSerializer, responses={200: RunGetSerializer}, summary = 'Also add "id" in request payoad while calling PATCH API')
)
class RunList(APIView):
    permission_classes = [AllowAny]
    ai_score = ""
    score_result = True
    app_hash_id = ""
    response_type = ""
    credits = 0

    def check_payload(self, data, request):
            try:
                # Safely get user ID, treating None user as unauthenticated
                user_id = getattr(getattr(request, 'user', None), 'id', None)
                
                # Log authentication classes and authenticators
                if hasattr(request, '_authenticator'):
                    log.info(f"Current authenticator: {request._authenticator}")
                
                # Check if user is authenticated by checking user_id instead of request.user
                if user_id is not None:
                    log.info("User is authenticated, checking required fields...")
                    required_fields = [
                        "user_id",
                        "ma_id"
                    ]
                else:
                    required_fields = []

                for field in required_fields:
                    if data.get(field) is None:
                        return False

                if data.get("scored_run") and (data.get("minimum_score") is None or data.get("rubric") is None):
                    return False

                return True

            except Exception as e:
                log.error(e)

    def route_api_response(self, response, data, api_params, model, app_owner_id, ip):
        try:
            usage = response
            if not (session_id := data.get("session_id")):
                session_id = uuid.uuid4()

            credits = response["credits"]
            self.credits = credits  # Store for later use in update_user_credits

            # Round the cost to 6 decimal places
            cost = round(float(response["cost"]), 6)

            # Ensure max_tokens is set from api_params if not in data
            max_tokens = data.get("max_tokens", api_params.get("max_tokens", 0))
            app_hash_id = self.app_hash_id or data.get("app_hash_id", '')

            run_data = {
                "ma_id": int(data.get("ma_id")),
                "user_id": data.get("user_id"),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": str(session_id),
                "satisfaction": 0,
                "prompt": api_params["messages"],
                "no_submission": data.get("no_submission", False),
                "ai_model": api_params["model"],
                "temperature": float(api_params["temperature"]),
                "max_tokens": max_tokens,
                "top_p": api_params["top_p"],
                "frequency_penalty": api_params["frequency_penalty"],
                "presence_penalty": api_params["presence_penalty"],
                "scored_run": data.get("scored_run", False),
                "run_score": self.ai_score,
                "minimum_score": data.get("minimum_score", 0.0),
                "rubric": str(data.get("rubric")),
                "run_passed": self.score_result,
                "request_skip": data.get("request_skip", False),
                "credits": credits,
                "cost": cost,
                "response": usage["ai_response"],
                "input_tokens": usage["prompt_tokens"],
                "output_tokens": usage["completion_tokens"],
                "owner_id": app_owner_id,
                "user_ip": ip,
                "system_prompt": data.get("system_prompt", {}),
                "phase_instructions": data.get("phase_instructions", {}),
                "user_prompt": data.get("user_prompt", {}),
                "app_hash_id": app_hash_id,
                "response_type": self.response_type,
            }
            return run_data
        except Exception as e:
            log.error(e)
            log.error(f"Response data: {response}")

    def skip_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "You skipped this phase", "cost": 0, "credits": 0}

    def no_submission_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "No submission", "cost": 0, "credits": 0 }

    def fixed_response_phase(self, fixed_response):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": fixed_response, "cost": 0, "credits": 0}

    def update_user_credits(self, run_id, app_owner_id, consumer_id):
        try:
            billing_cycle = BillingCycle.objects.filter(
                user=app_owner_id,
                status='open',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).first()

            main_available = billing_cycle.credits_remaining
            
            top_ups = TopUpToSubscription.objects.filter(user=app_owner_id)
            
            original_credits = self.credits
            credits_to_deduct = original_credits

            if main_available >= credits_to_deduct:
                billing_cycle.record_usage(credits_to_deduct)
                credits_to_deduct = 0
            else:
                billing_cycle.record_usage(main_available)
                credits_to_deduct -= main_available

            if credits_to_deduct > 0:
                top_ups_to_update = top_ups.filter(allocated_credits__gt=F('used_credits')).order_by('created_at')
                for top_up in top_ups_to_update:
                    if credits_to_deduct <= 0:
                        break
                    available_in_topup = top_up.remaining_credits
                    if available_in_topup >= credits_to_deduct:
                        top_up.record_usage(credits_to_deduct)
                        credits_to_deduct = 0
                    else:
                        top_up.record_usage(available_in_topup)
                        credits_to_deduct -= available_in_topup
                
            try:
                # Create usage event
                usage_event_data = {
                    "billing_cycle": billing_cycle.id,
                    "top_up": top_up.id if top_up else None,
                    "user": app_owner_id,
                    "consumer": consumer_id,
                    "run_id": run_id,
                    "credits_charged": original_credits,
                    "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                serializer = UsageEventSerializer(data=usage_event_data)
                if serializer.is_valid():
                    serializer.save()
                    
                    return True
                
                log.error(serializer.errors)
                return False
                
            except ValueError as e:
                log.error(f"Error recording usage: {str(e)}")
                return False
                    
            
        except Exception as e:
            log.error(e)
            return False

    def post(self, request, format=None):
        try:
            data = request.data
            #If field exists, convert to float:
            if data.get("temperature"): data["temperature"] = float(data.get("temperature"))
            if data.get("frequency_penalty"): data["frequency_penalty"] = float(data.get("frequency_penalty"))
            if data.get("presence_penalty"): data["presence_penalty"] = float(data.get("presence_penalty"))
            if data.get("top_p"): data["top_p"] = float(data.get("top_p"))
            if data.get("minimum_score"): data["minimum_score"] = float(data.get("minimum_score"))
            if data.get("max_tokens"): data["max_tokens"] = int(data.get("max_tokens"))
            
            # Check for mandatory keys in the user request payload
            if not self.check_payload(data, request):    
                return Response(
                    error.FIELD_MISSING,
                    status = status.HTTP_400_BAD_REQUEST,
                )
            ip = get_user_ip(request)
            # Handle guest users usage
            if not request.user.id:
                if not GuestUsage.check_usage_limit(self, ip):
                    return Response(error.RUN_USAGE_LIMIT_EXCEED, status = status.HTTP_400_BAD_REQUEST)
                app_owner_id = None
            # Handle logged-in users usage
            else:
                # Get microapp owner id
                app_owner = MicroAppUserJoin.objects.get(ma_id = data.get("ma_id"),role = "owner")
                app_owner_id = MicroappUserSerializer(app_owner).data["user_id"]
                # Get ma hash_id
                ma_data = Microapp.objects.get(id=data.get("ma_id"))
                self.app_hash_id = MicroAppSerializer(ma_data).data["hash_id"]
                # Get owner details
                users = CustomUser.objects.get(id = app_owner_id)
                user_date_joined = UserSerializer(users).data["date_joined"]
                # Check if the owner has any credits available
                credits_check = RunUsage.check_for_available_credits(self, app_owner_id, user_date_joined)
                if not credits_check["has_credits"]:
                    return Response(
                        {"error": credits_check["message"]},
                        status = status.HTTP_400_BAD_REQUEST
                    )
                
            # Return model instance based on AI-model name
            print("data.get('model')", data.get("model"))
            model_router = AIModelRoute().get_ai_model(data.get("model", env("DEFAULT_AI_MODEL")))
           
            if not model_router:
                return Response({"error": error.UNSUPPORTED_AI_MODEL, "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST)
           
            model = model_router["model"]

            # Validate model specific API request payload
            ai_validation = model.validate_params(data) 
            
            if not ai_validation["status"]:
                return Response({"error": error.validation_error(ai_validation["message"]), "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Retrieve default API parameters for the AI model
            api_params = model.get_default_params(data)
            
            # Format model specific message content  
            api_params["messages"] = model.get_model_message(api_params["messages"], data)
            # Handle skip phase
            if data.get("request_skip"):
                response = self.skip_phase()
                self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            elif data.get("fixed_response"):
               # Handle hardcoded phase
                response = self.fixed_response_phase(data.get("fixed_response"))
                self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            elif data.get("no_submission"):
               # Handle no-submission phase
               response = self.no_submission_phase()
               self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            # Handle score phase
            elif data.get("scored_run"):
                response = model.get_response(api_params)
                response = response["data"]
                api_params["messages"] = model.build_instruction(data, api_params["messages"])
                score_response = model.score_response(api_params, data.get("minimum_score"))
                self.ai_score = score_response["ai_score"]
                self.score_result = score_response["score_result"]
                response.update({
                    "prompt_tokens": response["prompt_tokens"] + score_response["prompt_tokens"],
                    "completion_tokens": response["completion_tokens"] + score_response["completion_tokens"],
                })
                response.update({
                    "cost": response["cost"] + score_response["cost"],
                })
                response.update({
                    "credits": response["credits"] + score_response["credits"],
                })
                self.response_type = MicroappVariables.DEFAULT_RESPONSE_TYPE
            # Handle basic feedback phase
            else:
                response = model.get_response(api_params)
                if not response["status"]:
                    return Response({"error": error.INVALID_PAYLOAD, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
                response = response["data"]
                
                self.response_type = MicroappVariables.DEFAULT_RESPONSE_TYPE
            # Create response data
            run_data = self.route_api_response(response, data, api_params, model, app_owner_id, ip)
            
            serializer = RunGetSerializer(data=run_data)
            if serializer.is_valid():
                
                serialize = serializer.save()
                self.update_user_credits(serialize.id, app_owner_id, request.user.id if request.user.id else None)
                run_data["id"] = serialize.id
                run_data["credits"] = self.credits

                # Handle hardcoded phase response
                if run_data["response"] == "":
                    return Response(
                    {"data": [], "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
                return Response(
                    {"data": run_data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MicroAppUserJoin.DoesNotExist:
            return Response(error.MICROAPP_NOT_EXIST, status = status.HTTP_400_BAD_REQUEST)
       
        except CustomUser.DoesNotExist:
            return Response(error.USER_NOT_EXIST, status = status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            return handle_exception(e)

    def get(self, request, *args, **kwargs):
        try:
            filters = {
                "user_id": request.GET.get("user_id"),
                "ma_id": request.GET.get("ma_id"),
                "session_id": request.GET.get("session_id"),
                "timestamp__date__gte": request.GET.get("start_date"),
                "timestamp__date__lte": request.GET.get("end_date"),
            }
            filters = {k: v for k, v in filters.items() if v is not None}
            queryset = Run.objects.filter(**filters)
            serializer = RunGetSerializer(queryset, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)
    
    def patch(self, request):
        try:
            data = request.data
            if self.checkPatchPayload(data):
                id_value = data.get("id")
                del data["id"]
                
                # Check if the ID is a UUID (contains hyphens)
                if isinstance(id_value, str) and '-' in id_value:
                    # Try to find the Run by session_id
                    run_object = Run.objects.filter(session_id=id_value).first()
                    if not run_object:
                        return Response(
                            {"error": "Run not found with the provided session ID", "status": status.HTTP_404_NOT_FOUND},
                            status=status.HTTP_404_NOT_FOUND,
                        )
                else:
                    # Use the ID directly
                    run_object = Run.objects.get(id=id_value)
                
                serializer = RunGetSerializer(run_object, data, partial=True)
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
            return Response(error.INVALID_PAYLOAD, status = status.HTTP_400_BAD_REQUEST)
        except Run.DoesNotExist:
            return Response(
                {"error": "Run not found", "status": status.HTTP_404_NOT_FOUND},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                error.SERVER_ERROR,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    def checkPatchPayload(self, data):
        try:
            if not data.get("id"):
                return False
            immutable_fields = ["ma_id", "user_id", "user_ip", "owner_id", "app_hash_id"]
            for field in immutable_fields:
                if data.get(field):
                    return False
            return True
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    post=extend_schema(request=RunPostSerializer, responses={200: RunGetSerializer}, summary="Run a model anonymously without authentication")
)
class AnonymousRunList(RunList):
    permission_classes = [AllowAny]
    authentication_classes = []

    def check_payload(self, data, request):
        try:
            # For anonymous runs, we don't require user_id or ma_id
            required_fields = [
                "ma_id"
            ]

            for field in required_fields:
                if data.get(field) is None:
                    return False

            if data.get("scored_run") and (data.get("minimum_score") is None or data.get("rubric") is None):
                return False

            return True
        except Exception as e:
            log.error(e)
            return False

    def post(self, request, format=None):
        try:
            data = request.data
            # Convert numeric fields to appropriate types
            if data.get("temperature"): data["temperature"] = float(data.get("temperature"))
            if data.get("frequency_penalty"): data["frequency_penalty"] = float(data.get("frequency_penalty"))
            if data.get("presence_penalty"): data["presence_penalty"] = float(data.get("presence_penalty"))
            if data.get("top_p"): data["top_p"] = float(data.get("top_p"))
            if data.get("minimum_score"): data["minimum_score"] = float(data.get("minimum_score"))
            if data.get("max_tokens"): data["max_tokens"] = int(data.get("max_tokens"))
            
            try:
                app_owner = MicroAppUserJoin.objects.get(ma_id=data.get("ma_id"), role="owner")
                app_owner_id = app_owner.user_id.id
            except MicroAppUserJoin.DoesNotExist:
                return Response({"error": "Microapp owner not found", "status": status.HTTP_404_NOT_FOUND},
                    status=status.HTTP_404_NOT_FOUND)
            
            # Check for mandatory keys in the user request payload
            if not self.check_payload(data, request):    
                return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ip = get_user_ip(request)
            
            # Handle guest users usage
            if not GuestUsage.check_usage_limit(self, ip):
                return Response(error.RUN_USAGE_LIMIT_EXCEED, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Get microapp owner id
                app_owner = MicroAppUserJoin.objects.get(ma_id = data.get("ma_id"),role = "owner")
                app_owner_id = MicroappUserSerializer(app_owner).data["user_id"]
                # Get ma hash_id
                ma_data = Microapp.objects.get(id=data.get("ma_id"))
                self.app_hash_id = MicroAppSerializer(ma_data).data["hash_id"]
                # Get owner details
                users = CustomUser.objects.get(id = app_owner_id)
                user_date_joined = UserSerializer(users).data["date_joined"]
                # Check if the owner has any credits available
                credits_check = RunUsage.check_for_available_credits(self, app_owner_id, user_date_joined)
                if not credits_check["has_credits"]:
                    return Response(
                        {"error": credits_check["message"]},
                        status = status.HTTP_400_BAD_REQUEST
                    )
            
            # Return model instance based on AI-model name
            model_router = AIModelRoute().get_ai_model(data.get("model", env("DEFAULT_AI_MODEL")))
           
            if not model_router:
                return Response({"error": error.UNSUPPORTED_AI_MODEL, "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST)
           
            model = model_router["model"]

            # Validate model specific API request payload
            ai_validation = model.validate_params(data) 
            
            if not ai_validation["status"]:
                return Response({"error": error.validation_error(ai_validation["message"]), "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Retrieve default API parameters for the AI model
            api_params = model.get_default_params(data)
            
            # Format model specific message content  
            api_params["messages"] = model.get_model_message(api_params["messages"], data)

            # Handle skip phase
            if data.get("request_skip"):
                response = self.skip_phase()
                self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            elif data.get("fixed_response"):
               # Handle hardcoded phase
                response = self.fixed_response_phase(data.get("fixed_response"))
                self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            elif data.get("no_submission"):
               # Handle no-submission phase
               response = self.no_submission_phase()
               self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            # Handle score phase
            elif data.get("scored_run"):
                response = model.get_response(api_params)
                response = response["data"]
                api_params["messages"] = model.build_instruction(data, api_params["messages"])
                score_response = model.score_response(api_params, data.get("minimum_score"))
                self.ai_score = score_response["ai_score"]
                self.score_result = score_response["score_result"]
                response.update({
                    "prompt_tokens": response["prompt_tokens"] + score_response["prompt_tokens"],
                    "completion_tokens": response["completion_tokens"] + score_response["completion_tokens"],
                })
                response.update({
                    "cost": response["cost"] + score_response["cost"],
                })
                response.update({
                    "credits": response["credits"] + score_response["credits"],
                })
                self.response_type = MicroappVariables.DEFAULT_RESPONSE_TYPE
            # Handle normal phase
            else:
                response = model.get_response(api_params)
                response = response["data"]
                self.response_type = MicroappVariables.DEFAULT_RESPONSE_TYPE

            run_data = self.route_api_response(response, data, api_params, model, app_owner_id, ip)
            
            # For anonymous runs, ensure these fields are None/empty
            run_data["user_id"] = None

            serializer = RunGetSerializer(data=run_data)

            if serializer.is_valid():
                serialize = serializer.save()
                self.update_user_credits(serialize.id, app_owner_id, request.user.id if request.user.id else None)
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            log.error(e)
            return Response(
                error.SERVER_ERROR,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class AIModelRoute:
   
   @staticmethod
   def get_ai_model(model_name):
        try:
            model_config = AIModelConstants.get_configs(model_name)
            if not model_config:
                return False
            
            # Use the unified interface for all models
            return {"model": UnifiedLLMInterface(model_config), "config": model_config}
            
        except Exception as e:
           return handle_exception(e)
   
class AIModelConfigurations(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses={200: str},
        summary="Get available AI models configuration"
    )
    def get(self, request, format=None):
        try:
            models = []
            for model_name, config in AIModelConstants.AI_MODELS.items():
                models.append({
                    "model": model_name,
                    "friendly_name": config["model"],
                    "temperature_range": {
                        "min": config["temperature_min"],
                        "max": config["temperature_max"]
                    }
                })

            return Response({"data": models, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer}, summary="Get microapp by hash_id"),
)
class MicroAppDetailsByHash(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, hash_id):
        try:
            return Microapp.objects.get(hash_id=hash_id)
        except Microapp.DoesNotExist:
            return None

    def get(self, request, hash_id, format=None):
        try:
            snippet = self.get_object(hash_id)
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
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}, summary="Get microapp by hash_id without authentication")
)
class PublicMicroAppsByHash(APIView):
    permission_classes = [AllowAny]
    def get(self, request, hash_id):
        try:
            microapp = Microapp.objects.get(hash_id=hash_id)    
            serializer = MicroAppSerializer(microapp)
            if serializer.data["privacy"] != "public":
                return Response({"error": "The App is not public", "status": status.HTTP_403_FORBIDDEN}, status = status.HTTP_403_FORBIDDEN)
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status = status.HTTP_200_OK)
        
        except Microapp.DoesNotExist:
            return Response(error.MICROAPP_NOT_EXIST, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary="Get user role for a microapp using hash_id"),
)
class UserMicroAppsRoleByHash(APIView):
    permission_classes = [IsAuthenticated]

    def get_microapp(self, hash_id):
        try:
            return Microapp.objects.get(hash_id=hash_id)
        except Microapp.DoesNotExist:
            return None

    def get_objects(self, uid, hash_id):
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

@extend_schema_view(
    get=extend_schema(responses={200: dict}, summary="Get app's visibility status by hash_id")
)
class MicroAppVisibility(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, hash_id):
        try:
            # Try to get the app
            microapp = Microapp.objects.get(hash_id=hash_id)    
            return Response({
                "data": {
                    "isPublic": microapp.privacy == "public"
                }, 
                "status": status.HTTP_200_OK
            }, status=status.HTTP_200_OK)
        
        except Microapp.DoesNotExist:
            # Return the same response as if the app exists but is private
            return Response({
                "data": {
                    "isPublic": False
                }, 
                "status": status.HTTP_200_OK
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(
        responses={200: BillingDetailsSerializer},
        summary="user-billing-details"
    )
)
class BillingDetails(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, format=None):
        billing_details = BillingCycle.objects.filter(user=request.user.id)
        serializer = BillingDetailsSerializer(billing_details, many=True)
        
        # Calculate total remaining top-up credits for the user
        # remaining_credits = allocated_credits - used_credits for each top-up
        top_up_total = TopUpToSubscription.objects.filter(user=request.user).aggregate(
            total=Sum(
                ExpressionWrapper(
                    F('allocated_credits') - F('used_credits'),
                    output_field=IntegerField()
                )
            )
        )['total'] or 0

        return Response({
            "billing_details": serializer.data,
            "top_up_credits": top_up_total,
            "status": status.HTTP_200_OK,
        }, status=status.HTTP_200_OK)

@extend_schema_view(
    get=extend_schema(responses={200: dict}, summary="Get user apps run statistics")
)
class AppStatistics(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user_id = request.user.id
            app_id = request.GET.get('app_id')
            hash_id = request.GET.get('hash_id')

            # Base query for user's runs
            query = Run.objects.filter(owner_id=user_id)

            # Filter by app_id or hash_id if provided
            if app_id:
                query = query.filter(ma_id=app_id)
            elif hash_id:
                query = query.filter(app_hash_id=hash_id)

            runs = query.values('ma_id').annotate(
                response_count=Count(
                    Case(
                        When(satisfaction__in=[1, -1], then=1)
                    )
                ),
                net_satisfaction_score=Case(
                    When(
                        Q(response_count=0),
                        then=Value(0, output_field=FloatField()) 
                    ),
                    default=Round(
                        Sum(
                            Case(
                                When(satisfaction__in=[1], then=F('satisfaction')),
                                default=Value(0)
                            )
                        ) * 1.0 / F('response_count'),
                        4
                    ),
                    output_field=FloatField()  
                ),
                thumbs_up_count=Count(
                    Case(
                        When(satisfaction=1, then=1)
                    )
                ),
                thumbs_down_count=Count(
                    Case(
                        When(satisfaction=-1, then=1)
                    )
                ),
                total_responses=Count(
                    Case(
                        When(satisfaction__in=[1, -1], then=1)
                    )
                ),
                total_cost=Sum(
                    'cost'
                ),
                total_credits=Sum('credits'),
                unique_users=Count('user_ip', distinct=True),
                sessions=Count('session_id', distinct=True),
                avg_cost_session = F('total_cost') / F('sessions'),
                avg_credits_session = F('total_credits') / F('sessions'),


            ).values('ma_id', 'net_satisfaction_score', 'thumbs_up_count', 'thumbs_down_count', 'total_responses', 'total_cost', 'total_credits', 'unique_users', 'sessions' ,'avg_cost_session', 'avg_credits_session')
       
            return Response({"data": runs, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)  
              
        except Exception as e:
            return handle_exception(e)

class AppConversations(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user_id = request.user.id
            app_id = request.GET.get('app_id')
            hash_id = request.GET.get('hash_id')

            # Base query for user's runs
            query = Run.objects.filter(owner_id=user_id)

            # Filter by app_id or hash_id if provided
            if app_id:
                query = query.filter(ma_id=app_id)
            elif hash_id:
                query = query.filter(app_hash_id=hash_id)

            # Step 1: Add annotations for satisfaction and model mode
            conversations = query.values('session_id').annotate(
                start_time=Min('timestamp'),
                total_cost=Sum('cost'),
                messages_count=Count('id'),
                total_credits=Sum('credits')
            )

            # Step 2: For satisfaction and ai_model, calculate mode separately
            for conversation in conversations:
                session_id = conversation['session_id']

                # Calculate mode for 'satisfaction'
                satisfaction_mode = (
                    query.filter(
                        session_id=session_id,
                        satisfaction__isnull=False,  # Exclude NULL values
                        satisfaction__in=[1, -1]     # Only consider valid satisfaction values
                    )
                    .values('satisfaction')
                    .annotate(count=Count('satisfaction'))
                    .order_by('-count', 'satisfaction')
                    .first()
                )
                conversation['satisfaction'] = satisfaction_mode['satisfaction'] if satisfaction_mode else None

                # Calculate mode for 'ai_model'
                model_mode = (
                    query.filter(session_id=session_id)
                    .values('ai_model')
                    .annotate(count=Count('ai_model'))
                    .order_by('-count', 'ai_model')  # Secondary order by 'ai_model' for consistency
                    .first()
                )
                conversation['model'] = model_mode['ai_model'] if model_mode else None

            # Step 3: Order by start_time
            conversations = sorted(conversations, key=lambda x: x['start_time'], reverse=True)

            return Response(
                {"data": conversations, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return handle_exception(e)

class AppConversationDetails(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            session_id = request.GET.get('session_id')
            if not session_id:
                return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get the conversation details, but only if user is the owner
            conversation = Run.objects.filter(
                session_id=session_id,
                owner_id=request.user.id
            ).values(
                'timestamp',
                'system_prompt',
                'phase_instructions',
                'user_prompt',
                'response',
                'rubric',
                'run_score',
                'run_passed'
            ).order_by('timestamp')

            if not conversation.exists():
                return Response(
                    {"error": "Conversation not found or you don't have permission to view it", 
                     "status": status.HTTP_404_NOT_FOUND},
                    status=status.HTTP_404_NOT_FOUND
                )

            return Response(
                {"data": list(conversation), "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return handle_exception(e)

@extend_schema_view(
    get=extend_schema(
        summary="Get user's app quota information",
        description="Returns information about the user's app creation limits and current usage, including total limit, used count, remaining apps, and whether they can create more apps.",
        responses={
            200: {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "object",
                        "properties": {
                            "limit": {"type": "integer", "description": "Total number of apps allowed based on subscription"},
                            "used": {"type": "integer", "description": "Current number of apps created"},
                            "remaining": {"type": "integer", "description": "Number of apps that can still be created"},
                            "can_create": {"type": "boolean", "description": "Whether the user can create more apps"}
                        }
                    },
                    "status": {"type": "integer", "example": 200}
                }
            }
        }
    )
)
class AppQuota(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get usage info from MicroAppUsage
            usage_info = MicroAppUsage.check_max_apps(request.user.id)
            
            # Calculate remaining apps
            remaining_apps = usage_info["limit"] - usage_info["current_count"]
            
            return Response({
                "data": {
                    "limit": usage_info["limit"],
                    "used": usage_info["current_count"],
                    "remaining": remaining_apps,
                    "can_create": usage_info["can_create"]
                },
                "status": status.HTTP_200_OK
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return handle_exception(e)

class MicroAppImageUpload(APIView):
    permission_classes = [IsAuthenticated]

    def get_microapp(self, app_id):
        try:
            return Microapp.objects.get(id=app_id)
        except Microapp.DoesNotExist:
            return None

    @extend_schema(
        request=ImageUploadSerializer,
        responses={200: PresignedUrlResponse},
        summary="Upload image for microapp"
    )
    def post(self, request, pk=None):
        """
        Upload image for microapp
        """

        # Validate microapp ID is provided
        if not pk:
            return Response(
                {"error": "Microapp ID is required", "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if microapp exists
        microapp = self.get_microapp(pk)
        if not microapp:
            return Response(
                {"error": "Microapp not found", "status": status.HTTP_404_NOT_FOUND},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ImageUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filename = serializer.validated_data['filename']
        content_type = serializer.validated_data['content_type']

        # Sanitize filename to remove any potentially problematic characters
        filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
        
        try:
            s3_client = boto3.client(
                's3',
                config=Config(signature_version='s3v4'),
                region_name=settings.AWS_S3_REGION_NAME,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )

            # Use the validated microapp ID in the file path
            file_key = f'microapps/{microapp.id}/images/{filename}'

            conditions = [
                {'bucket': settings.AWS_STORAGE_BUCKET_NAME},
                ['starts-with', '$key', f'microapps/{microapp.id}/images/'],
                {'Content-Type': content_type}
            ]

            expiration = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
            
            response = s3_client.generate_presigned_post(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                Fields={
                    'Content-Type': content_type
                },
                Conditions=conditions,
                ExpiresIn=300
            )

            # Return the complete presigned POST response
            formatted_response = {
                'data': {
                    'url': response['url'],
                    'fields': {
                        **response['fields'],
                        'key': file_key,
                        'filename': filename
                    }
                }
            }

            return Response(formatted_response)
        except Exception as e:
            log.error(f"S3 presigned URL generation error: {str(e)}")
            return handle_exception(e)

class MicroAppFileUpload(APIView):
    permission_classes = [IsAuthenticated]

    def get_microapp(self, app_id):
        try:
            return Microapp.objects.get(id=app_id)
        except Microapp.DoesNotExist:
            return None

    def upload_to_s3(self, file_key, file_content, content_type):
        """Helper method to upload content to S3"""
        try:
            s3_client = boto3.client(
                's3',
                config=Config(signature_version='s3v4'),
                region_name=settings.AWS_S3_REGION_NAME,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            
            s3_client.put_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                Body=file_content,
                ContentType=content_type
            )
            return True
        except Exception as e:
            log.error(f"S3 upload error: {str(e)}")
            return False

    def count_words(self, text):
        """Count words efficiently without loading full text into memory"""
        count = 0
        for word in text.split():
            count += 1
        return count

    @extend_schema(
        request=FileUploadSerializer,
        responses={200: PresignedUrlResponse},
        summary="Upload file for microapp"
    )
    def post(self, request, pk=None):
        if not pk:
            return Response({"error": "Microapp ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        microapp = self.get_microapp(pk)
        if not microapp:
            return Response({"error": "Microapp not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = FileUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filename = re.sub(r'[^a-zA-Z0-9._-]', '', serializer.validated_data['filename'])
        content_type = serializer.validated_data['content_type']
        
        # Define S3 keys for both files
        original_file_key = f'microapps/{microapp.id}/files/original/{filename}'
        base_name, ext = os.path.splitext(filename)
        text_file_key = f'microapps/{microapp.id}/files/text/{base_name}__{ext[1:]}.txt'

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create a temporary file and process it
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_file.flush()
                
                try:
                    # Extract text content
                    processor = DocumentProcessor()
                    parsed_content = processor.extract_text(temp_file.name)
                    
                    # Count words
                    word_count = self.count_words(parsed_content)

                    # Upload original file to S3
                    uploaded_file.seek(0)
                    original_upload_success = self.upload_to_s3(
                        original_file_key, 
                        uploaded_file.read(), 
                        content_type
                    )

                    # Upload extracted text to S3
                    text_upload_success = self.upload_to_s3(
                        text_file_key,
                        parsed_content.encode('utf-8'),
                        'text/plain'
                    )

                    if not (original_upload_success and text_upload_success):
                        return Response(
                            {"error": "Failed to upload files to S3"}, 
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )

                    # Only return a preview of the content
                    preview_length = 1000  # First 1000 characters
                    content_preview = parsed_content[:preview_length]
                    has_more = len(parsed_content) > preview_length

                    return Response({
                        'data': {
                            'original_file': original_file_key,
                            'text_file': text_file_key,
                            'content_preview': content_preview,
                            'has_more_content': has_more,
                            'word_count': word_count
                        }
                    }, status=status.HTTP_200_OK)

                finally:
                    # Clean up the temporary file
                    os.unlink(temp_file.name)

        except Exception as e:
            log.error(f"File processing error: {str(e)}")
            return handle_exception(e)