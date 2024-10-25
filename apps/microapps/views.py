# \micro_ai\apps\microapps\views.py
import datetime
import re
import uuid
import os
from pathlib import Path
import environ
import logging as log
from django.forms import model_to_dict
from rest_framework import status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework.permissions import IsAuthenticated, AllowAny 
from openai import OpenAI
import google.generativeai as genai
from anthropic import Anthropic
from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.custom_permissions import (
    IsAdminOrOwner,
    IsOwner,
    AdminRole
)
from apps.microapps.serializer import (
    AiModelConfigSerializer,
    MicroAppSerializer,
    MicroappUserSerializer,
    MicroAppSwaggerPostSerializer,
    MicroAppSwaggerPutSerializer,
    AssetsSerializer,
    AssetsMicroappSerializer,
    RunPostSerializer,
    RunGetSerializer,
    RunPatchSerializer
)
from apps.users.serializers import UserSerializer
from apps.users.models import CustomUser
from apps.utils.uasge_helper import RunUsage, MicroAppUasge, GuestUsage, get_user_ip
from django.db.models import Sum
from apps.utils.global_varibales import AIModelVariables, AIModelConstants, MicroappVariables
from apps.microapps.models import Microapp, MicroAppUserJoin, Run, GPTModel, GeminiModel, ClaudeModel
from apps.collection.models import Collection, CollectionMaJoin, CollectionUserJoin
from apps.collection.serializer import CollectionMicroappSerializer, CollectionUserSerializer
from rest_framework.exceptions import PermissionDenied
from rest_framework import generics

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))


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

    def add_microapp_user(self, uid, microapp):
        try:
            data = {"role": MicroappVariables.APP_OWNER, "ma_id": microapp.id, "user_id": uid}
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
                if MicroAppUasge.microapp_related_info(request.user.id):
                    serializer = MicroAppSerializer(data=data)
                    if serializer.is_valid():
                        microapp = serializer.save()
                        self.add_microapp_user(uid=request.user.id, microapp=microapp)
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
                    error.MICROAPP_USAGE_LIMIT_EXCEED,
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

    def delete(self, request, app_id, format=None):
        try:
            self.permission_classes = [IsOwner]
            self.check_permissions(request)
            micro_apps = self.get_object(app_id)
            if micro_apps:
                micro_apps.delete()
                return Response(status=status.HTTP_200_OK)
            return Response(error.MICROAPP_NOT_EXIST, status=status.HTTP_400_BAD_REQUEST)
        
        except PermissionDenied:
            return Response(error.OPERATION_NOT_ALLOWED, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return handle_exception(e)

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

    def post(self, request, pk, collection_id):
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

            if collection_id:
                if MicroAppUasge.microapp_related_info(request.user.id):
                    microapp_dict = model_to_dict(microapp)
                    del microapp_dict["id"]
                    microapp_dict["title"] = microapp_dict["title"] + " copy"
                    serializer = MicroAppSerializer(data = microapp_dict)
                    if serializer.is_valid():
                        microapp = serializer.save()
                        micro_app_list = MicroAppList
                        micro_app_list.add_microapp_user(self, uid=request.user.id, microapp=microapp)
                        micro_app_list.add_collection_microapp(self, collection_id, microapp)
                        return Response(
                            {"data": serializer.data, "status": status.HTTP_200_OK},
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
            return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST,
                ) 
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary="Get user role for a microapp"),
    delete=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary= "Delete user from a microapp"),
)
class UserMicroApps(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, uid, aid):
        try:
            return MicroAppUserJoin.objects.get(user_id=uid, ma_id=aid)
        except Exception as e:
            return handle_exception(e)

    def get_objects(self, uid, aid):
        try:
            return MicroAppUserJoin.objects.filter(user_id=uid, ma_id=aid)
        except Exception as e:
            return handle_exception(e)

    def get(self, request, app_id, user_id=None):
        try:
            if user_id:
                user_role = self.get_objects(user_id, app_id)
                if user_role:
                    serializer = MicroappUserSerializer(user_role, many=True)
                    return Response(
                        {"data": serializer.data, "status": status.HTTP_200_OK},
                        status=status.HTTP_200_OK,
                    )
                return Response(
                    error.USER_NOT_EXIST,
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            return handle_exception(e)

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

@extend_schema_view(
    get=extend_schema(responses={200: MicroappUserSerializer(many=True)}, summary="Get all users role for a microapp"),
)
class UserMicroAppList(generics.ListAPIView):
    serializer_class = MicroappUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            app_id = self.kwargs['app_id']
            return MicroAppUserJoin.objects.filter(ma_id=app_id)
        except Exception as e:
            return handle_exception(e)
            
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
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
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

    def check_payload(self, data, request):
            try:
                if request.user.id:
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

    def route_api_response(self, response, data, api_params,model, app_owner_id, ip):
       try:
            usage = response
            if not (session_id := data.get("session_id")):
                session_id = uuid.uuid4()
            run_data = {
                "ma_id": int(data.get("ma_id")),
                "user_id": data.get("user_id"),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": str(session_id),
                "satisfaction": 0,
                "prompt": api_params["messages"],
                "no_submission": data.get("no_submission", False),
                "ai_model": api_params["model"],
                "temperature": float(api_params["temperature"]),
                "max_tokens": data.get("max_tokens", model.model_config['max_tokens_default']),
                "top_p": api_params["top_p"],
                "frequency_penalty": api_params["frequency_penalty"],
                "presence_penalty": api_params["presence_penalty"],
                "scored_run": data.get("scored_run", False),
                "run_score": self.ai_score,
                "minimum_score": data.get("minimum_score", 0.0),
                "rubric": str(data.get("rubric")),
                "run_passed": self.score_result,
                "request_skip": data.get("request_skip", False),
                "credits": 0,
                "cost": response["cost"],
                "price_input_token_1M": response["price_input_token_1M"],
                "price_output_token_1M": response["price_output_token_1M"],
                "response": usage["ai_response"],
                "input_tokens": usage["prompt_tokens"],
                "output_tokens": usage["completion_tokens"],
                "owner_id": app_owner_id,
                "user_ip": ip
                }
            return run_data
       except Exception as e:
            log.error(e)

    def skip_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "You skipped this phase", "cost": 0, "price_input_token_1M": 0, "price_output_token_1M":0}

    def no_submission_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "No submission", "cost": 0, "price_input_token_1M": 0, "price_output_token_1M":0}

    def hard_coded_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "", "cost": 0, "price_input_token_1M": 0, "price_output_token_1M":0}

    def post(self, request, format=None):
        try:
            data = request.data
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
                if not GuestUsage.get_run_related_info(self, ip):
                    return Response(error.RUN_USAGE_LIMIT_EXCEED, status = status.HTTP_400_BAD_REQUEST)
                app_owner_id = None
            # Handle logged-in users usage
            else:
                # Get microapp owner id
                app_owner = MicroAppUserJoin.objects.get(ma_id = data.get("ma_id"),role = "owner")
                app_owner_id = MicroappUserSerializer(app_owner).data["user_id"]
                # Get owner details
                users = CustomUser.objects.get(id = app_owner_id)
                user_date_joined = UserSerializer(users).data["date_joined"]
                # Checking for usage limit
                if not RunUsage.get_run_related_info(self, app_owner_id, user_date_joined):
                    return Response(error.RUN_USAGE_LIMIT_EXCEED, status = status.HTTP_400_BAD_REQUEST)
            # Return model instance based on AI-model name
            model = AIModelRoute().get_ai_model(data.get("ai_model", env("DEFAULT_AI_MODEL")))
            if not model:
                return Response({"error": error.UNSUPPORTED_AI_MODEL, "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST)
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
            elif data.get("no_submission"):
                # Handle hardcoded phase
                if not data.get("prompt"):
                    response = self.hard_coded_phase()
                # Handle no-submission phase
                else:
                    response = self.no_submission_phase()
            # Handle score phase
            elif data.get("scored_run"):
                # check required prompt property for score phase
                if not data.get("prompt"):
                    return Response(error.PROMPT_REQUIRED, status = status.HTTP_400_BAD_REQUEST)
                response = model.get_response(api_params)
                api_params["messages"] = model.build_instruction(data, api_params["messages"])
                score_response = model.score_response(api_params, data.get("minimum_score"))
                self.ai_score = score_response["ai_score"]
                self.score_result = score_response["score_result"]
                response["prompt_tokens"] += score_response["prompt_tokens"]
                response["completion_tokens"] += score_response["completion_tokens"]
                response["cost"] = model.calculate_cost(response)
                response["price_input_token_1M"] = model.calculate_input_token_price(response)
                response["price_output_token_1M"] = model.calculate_output_token_price(response)
            # Handle basic feedback phase
            else:
                # check required prompt property for basic feedback phase
                if not data.get("prompt"):
                    return Response(error.PROMPT_REQUIRED, status = status.HTTP_400_BAD_REQUEST)
                response = model.get_response(api_params)
            # Create response data
            run_data = self.route_api_response(response, data, api_params, model, app_owner_id, ip)
            serializer = RunGetSerializer(data=run_data)
            if serializer.is_valid():
                serialize = serializer.save()
                run_data["id"] = serialize.id
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
                id = data.get("id")
                del data["id"]
                run_object = Run.objects.get(id = id)
                serializer = RunGetSerializer(run_object, data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data)
                return Response(serializer.errors)
            return Response(error.INVALID_PAYLOAD, status = status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return handle_exception(e)
    
    def checkPatchPayload(self, data):
        try:
            if not data.get("id"):
                return False
            immutable_fields = ["ma_id", "user_id", "user_ip", "owner_id"]
            for field in immutable_fields:
                if data.get(field):
                    return False
            return True
        except Exception as e:
            return handle_exception(e)

class AIModelRoute:
   
   @staticmethod
   def get_ai_model(model_name):
        try:
            model_config = AIModelConstants.get_configs(model_name)
            if "gpt" in model_name and model_config:
                return GPTModel(model_config["api_key"], model_config) 
            elif "gemini" in model_name and model_config:
                return GeminiModel(model_config["api_key"], model_name, model_config)
            elif "claude" in model_name and model_config:
                return ClaudeModel(model_config["api_key"], model_config)
            else:
                return False
        except Exception as e:
           return handle_exception(e) 
   
class AIModelConfigurations(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses={200: str},
        summary="Get available AI models configuration"
    )

    def get(self, request, format = None):
        try:
            models = [
            {"model": env("OPENAI_MODEL_NAME"), "friendly_name": "Gpt", "temperature_range": {"min": 0, "max": 2}},
            {"model": env("GEMINI_MODEL_NAME"), "friendly_name": "Gemini", "temperature_range": {"min": 0, "max": 2}},
            {"model": env("CLAUDE_MODEL_NAME"), "friendly_name": "Claude Opus", "temperature_range": {"min": 0, "max": 1}}]

            return Response({"data": models, "status": status.HTTP_200_OK}, status = status.HTTP_200_OK)
        except Exception as e:
            return handle_exception(e)

