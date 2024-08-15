import datetime
import re
import uuid
import os
from pathlib import Path
import environ
import logging as log
from django.forms import model_to_dict
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework.permissions import IsAuthenticated
from openai import OpenAI
import google.generativeai as genai
from anthropic import Anthropic
from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.custom_permissions import (
    IsAdminOrOwner,
    IsOwner
)
from apps.microapps.serializer import (
    AiModelConfigSerializer,
    MicroAppSerializer,
    MicroappUserSerializer,
    AssetsSerializer,
    AssetsMicroappSerializer,
    RunSerializer,
)
from apps.utils.global_varibales import AIModelVariables
from apps.microapps.models import AiModelConfig, Microapp, MicroAppUserJoin, Run
from apps.collection.models import Collection, CollectionMaJoin, CollectionUserJoin
from apps.collection.serializer import CollectionMicroappSerializer, CollectionUserSerializer
from rest_framework.exceptions import PermissionDenied
from rest_framework import generics
from django.core.exceptions import ObjectDoesNotExist

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
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
    post=extend_schema(request=MicroAppSerializer, responses={200: MicroAppSerializer}),
)
class MicroAppList(APIView):
    permission_classes = [IsAuthenticated]

    def add_microapp_user(self, uid, microapp):
        try:
            data = {"role": "owner", "ma_id": microapp.id, "user_id": uid}
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

    def add_assets(self, request, microapp):
        try:
            assets = request.data.get("assets")
            serializer = AssetsSerializer(data=assets)
            if serializer.is_valid():
                asset = serializer.save()
                return self.add_microapp_assets(microapp=microapp, asset=asset)
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)

    def add_microapp_assets(self, microapp, asset):
        try:
            data = {"ma_id": microapp.id, "asset_id": asset.id}
            serializer = AssetsMicroappSerializer(data=data)
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
            micro_apps = Microapp.objects.all()
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
            if (cid):
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
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
    put=extend_schema(request=MicroAppSerializer, responses={200: MicroAppSerializer}),
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
            if snippet:
                serializer = MicroAppSerializer(snippet)
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                error.MICROAPP_NOT_EXIST,
                status=status.HTTP_400_BAD_REQUEST,
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


class CloneMicroApp(APIView):
    permission_classes = [IsAuthenticated]

    def get_microapp(self, pk):
        try:
            return Microapp.objects.get(id=pk)
        except Microapp.DoesNotExist:
            return None

    def post(self, request, pk):
        try:
            global_app = self.get_microapp(pk)
            if not global_app:
                return Response(
                    error.MICROAPP_NOT_EXIST,
                    status=status.HTTP_400_BAD_REQUEST,
                )
            global_app_dict = model_to_dict(global_app)
            del global_app_dict["id"]
            serializer = MicroAppSerializer(data=global_app_dict)
            if serializer.is_valid():
                microapp = serializer.save()
                micro_app_list = MicroAppList
                micro_app_list.add_microapp_user(self, uid=request.user.id, microapp=microapp)
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
            if user_id:
                userapp = self.get_object(user_id, app_id)
                if userapp:
                    userapp.delete()
                    return Response(status=status.HTTP_200_OK)
                return Response(
                    error.MICROAPP_NOT_EXIST,
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                error.USER_NOT_EXIST,
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
            self.permission_classes = [IsOwner]
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
    
    def put(self, request, format=None):
        try:
            self.permission_classes = [IsOwner]
            self.check_permissions(request)
            data = request.data
            userapp = self.get_object(data.get("user_id"), data.get("ma_id"))
            serializer = MicroappUserSerializer(userapp, data=data)
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
    get=extend_schema(
        responses={200: RunSerializer(many=True)},
        parameters=[
            OpenApiParameter(name="ma_id", description="Optional Micro App ID", required=False),
            OpenApiParameter(name="user_id", description="Optional User ID", required=False),
            OpenApiParameter(name="session_id", description="Optional Session ID", required=False),
            OpenApiParameter(name="start_date", description="Optional Start Date", required=False),
            OpenApiParameter(name="end_date", description="Optional End Date", required=False),
        ],
    ),
    post=extend_schema(request=RunSerializer, responses={200: RunSerializer}),
)
class RunList(APIView):
    permission_classes = [IsAuthenticated]
    ai_score = ""
    score_result = True

    def check_payload(self, data):
        try:
            required_fields = [
                "ma_id",
                "user_id",
                "no_submission",
                "ai_model",
                "scored_run",
                "skippable_phase",
            ]
            required_fields.append("prompt") if data.get("no_submission") == False else None
            for field in required_fields:
                if data.get(field) is None:
                    return False

            if data.get("scored_run") and (data.get("minimum_score") is None or data.get("rubric") is None):
                return False

            return True
        except Exception as e:
            log.error(e)

    def route_api_response(self, response, data, api_params):
       try:
            usage = response
            if not (session_id := data.get("session_id")):
                session_id = uuid.uuid4()
            run_data = {
                "ma_id": data.get("ma_id"),
                "user_id": data.get("user_id"),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": str(session_id),
                "satisfaction": 0,
                "prompt": api_params["messages"],
                "no_submission": data.get("no_submission"),
                "ai_model": api_params["model"],
                "temperature": api_params["temperature"],
                "max_tokens": data.get("max_tokens", 4096),
                "top_p": api_params["top_p"],
                "frequency_penalty": api_params["frequency_penalty"],
                "presence_penalty": api_params["presence_penalty"],
                "scored_run": data.get("scored_run"),
                "run_score": self.ai_score,
                "minimum_score": data.get("minimum_score"),
                "rubric": str(data.get("rubric")),
                "run_passed": self.score_result,
                "skippable_phase": data.get("skippable_phase"),
                "credits": 0,
                "cost": response["cost"],
                "price_input_token_1M": response["price_input_token_1M"],
                "price_output_token_1M": response["price_output_token_1M"],
                "response": usage["ai_response"],
                "input_tokens": usage["prompt_tokens"],
                "output_tokens": usage["completion_tokens"]
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
            # Check for mandatory keys in the user request payload
            if not self.check_payload(data):
                return Response(
                    error.FIELD_MISSING,
                    status = status.HTTP_400_BAD_REQUEST,
                )
            try:
                model_query = AiModelConfig.objects.get(model_name=data.get('ai_model'))
                serializer = AiModelConfigSerializer(model_query)
            except ObjectDoesNotExist:
                return Response({"error": error.UNSUPPORTED_AI_MODEL,"status": status.HTTP_400_BAD_REQUEST},
                                status = status.HTTP_400_BAD_REQUEST,)
            # Return model instance based on ai-model name
            model = AIModelRoute().get_ai_model(data.get("ai_model"), serializer.data)
            # Validate model specific API request payload
            ai_validation = model.validate_params(data) 
            if not ai_validation["status"]:
                return Response(
                    error.validation_error(ai_validation["message"]),
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Retrieve default API parameters for the AI model
            api_params = model.get_default_params(data)
            # Format model specific message content  
            api_params["messages"] = model.get_model_message(api_params["messages"], data)
            # Handle skippbale phase
            if data.get("skippable_phase"):
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
                response = model.get_response(api_params)
            # Create reponse data
            run_data = self.route_api_response(response,data,api_params)
            serializer = RunSerializer(data=run_data)
            if serializer.is_valid():
                serialize = serializer.save()
                run_data["id"] = serialize.id
                # Handle hardcoded phase response
                if(run_data["response"] == ""):
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
            serializer = RunSerializer(queryset, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)


class BaseAIModel:
    def __init__(self, api_key, model_config):
        self.api_key = api_key
        self.model_config = model_config

    def get_response(self, api_params):
        pass

    def score_response(self, api_params, minimum_score):
        pass

    def extract_score(self, response):
        pass

    def calculate_cost(self, usage):
        pass
    
    def calculate_input_token_price(self, usage):
        pass

    def calculate_output_token_price(self, usage):
        pass

    def validate_params(self, data):
        pass

    def get_default_params(self, data):
        pass

    def get_model_message(self, messages, data):
        pass

    def build_instruction(self, data, params):
        pass

class AIModelRoute:
   
   gpt_api_key = env("OPENAI_API_KEY")
   gemini_api_key = env("GEMINI_API_KEY")
   claude_api_key = env("CLAUDE_API_KEY")
   
   @staticmethod
   def get_ai_model(model_name, model_config):
        try:
            if "gpt" in model_name:
                return GPTModel(AIModelRoute.gpt_api_key, model_config)
            elif "gemini" in model_name:
                return GeminiModel(AIModelRoute.gemini_api_key, model_name, model_config)
            elif "claude" in model_name:
                return ClaudeModel(AIModelRoute.claude_api_key, model_config)
        except Exception as e:
           return handle_exception(e)
    
class GPTModel(BaseAIModel):
    def __init__(self, api_key, model_config):
        super().__init__(api_key, model_config)
        self.client = OpenAI(api_key = self.api_key)

    def get_response(self, api_params):
        try:
            response = self.client.chat.completions.create(**api_params)
            usage = response.usage
            ai_response = response.choices[0].message.content
            calculation = {"completion_tokens": usage.completion_tokens, "prompt_tokens": usage.prompt_tokens, "total_tokens": usage.total_tokens,}
            return {
                "completion_tokens": usage.completion_tokens,
                "prompt_tokens": usage.prompt_tokens,
                "total_tokens": usage.total_tokens,
                "ai_response": ai_response,
                "cost": self.calculate_cost(calculation),
                "price_input_token_1M": self.calculate_input_token_price(calculation),
                "price_output_token_1M": self.calculate_output_token_price(calculation)
            }
        except Exception as e:
            return handle_exception(e)

    def score_response(self, api_params, minimum_score):
        try:
            response = self.client.chat.completions.create(**api_params)
            usage = response.usage
            ai_score = response.choices[0].message.content
            score_result = False
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
            return {
                    "completion_tokens": usage.completion_tokens,
                    "prompt_tokens": usage.prompt_tokens,
                    "total_tokens": usage.total_tokens,
                    "ai_score": ai_score,
                    "score_result": score_result
            }
        except Exception as e:
            return handle_exception(e)

    def extract_score(self, response):
        try:
            pattern = r'"total":\s*"?(\d+)"?'
            match = re.search(pattern, response)
            if match:
                return int(match.group(1))
            else:
                return 0
        except Exception as e:
            return handle_exception(e)
        
    def calculate_cost(self, usage):
        try:
            cost = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / 1_000_000 + self.model_config["output_token_price"] * usage["completion_tokens"] / 1_000_000, 6)
            return cost
        except Exception as e:
            return handle_exception(e)
    
    def calculate_input_token_price(self, usage):
        try:
            price_input_token_1M = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / 1_000_000, 6)    
            return price_input_token_1M
        except Exception as e:
            return handle_exception(e)
    
    def calculate_output_token_price(self, usage):
        try:
            price_output_token_1M = round(self.model_config["output_token_price"] * usage["completion_tokens"] / 1_000_000, 6)
            return price_output_token_1M
        except Exception as e:
            return handle_exception(e)

    def validate_params(self, data):
        try:
            params = {
                "temperature": (data.get("temperature"), self.model_config["temperature_min"], self.model_config["temperature_max"]),
                "frequency_penalty": (data.get("frequency_penalty"), self.model_config["frequency_penalty_min"], self.model_config["frequency_penalty_max"]),
                "presence_penalty": (data.get("presence_penalty"), self.model_config["presence_penalty_min"], self.model_config["presence_penalty_max"]),
                "top_p": (data.get("top_p"), self.model_config["top_p_min"], self.model_config["top_p_max"]),
            }
            for param, (value, min_val, max_val) in params.items():
                if value is not None and not (min_val <= value <= max_val):
                    return {"status": False, "message": f"Invalid {param} value"}
            return {"status": True}
        except Exception as e:
            log.error(e)
            return {"status": False, "message": error.VALIDATION_ERROR}
    
    def get_default_params(self, data):
        try:
            return {
                "model": data.get("ai_model"),
                "messages": data.get("message_history", []) + data.get("prompt", []),
                "temperature": data.get("temperature", 0),
                "frequency_penalty": data.get("frequency_penalty", 0),
                "presence_penalty": data.get("presence_penalty", 0),
                "top_p": data.get("top_p", 1),
                "max_tokens": data.get("max_tokens", self.model_config["max_tokens_default"])
            }
        except Exception as e:
                log.error(e)
                return {}
    
    def get_model_message(self, messages, data):
        try:
            return messages
        except Exception as e:
            log.error(e)
            return []
    
    def build_instruction(self, data, messages):
        try:
            instruction = (
            "Please provide a score for the previous user message. Use the following rubric:" 
            + str(data.get("rubric")) 
            + " Output your response as JSON, using this format: "
            + "{ '[criteria 1]': '[score 1]', '[criteria 2]': '[score 2]', 'total': '[sum of all scores of all criteria]' }."
            + " Make sure to include the 'total' key and its value in your response."
            )
            messages.append({"role": "user", "content": instruction})
            return messages
        except Exception as e:
            log.error(e)
    
class GeminiModel(BaseAIModel):
    def __init__(self, api_key, model, model_config):
        super().__init__(api_key, model_config)
        genai.configure(api_key = self.api_key)
        self.model = genai.GenerativeModel(model)

    def get_response(self, api_params):
        try:
            messages = api_params["messages"]
            response = self.model.generate_content(messages,generation_config=genai.types.GenerationConfig(
                temperature = api_params["temperature"],
                top_p = api_params["top_p"],
                max_output_tokens = api_params["max_tokens"]
            ))   
            usage = response.usage_metadata
            ai_response = response.candidates[0].content.parts[0].text
            calculation = { "completion_tokens":usage.candidates_token_count,"prompt_tokens": usage.prompt_token_count,"total_tokens": usage.total_token_count}
            return {
                    "completion_tokens":usage.candidates_token_count,
                    "prompt_tokens": usage.prompt_token_count,
                    "total_tokens": usage.total_token_count,
                    "ai_response": ai_response,
                    "cost": self.calculate_cost(calculation),
                    "price_input_token_1M": self.calculate_input_token_price(calculation),
                    "price_output_token_1M": self.calculate_output_token_price(calculation)
            }
        except Exception as e:
             return handle_exception(e)

    def score_response(self, api_params, minimum_score):
        try:
            messages = api_params["messages"]
            response = self.model.generate_content(messages,generation_config=genai.types.GenerationConfig(
                temperature = api_params["temperature"],
                top_p = api_params["top_p"],
                max_output_tokens = api_params["max_tokens"]
            ))   
            usage = response.usage_metadata
            ai_score = response.candidates[0].content.parts[0].text
            score_result = False
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
            return {
                    "completion_tokens":usage.candidates_token_count,
                    "prompt_tokens": usage.prompt_token_count,
                    "total_tokens": usage.total_token_count,
                    "ai_score": ai_score,
                    "score_result": score_result
            }
        except Exception as e:
                return handle_exception(e)

    def extract_score(self, response):
        try:
            pattern = r'["\']total["\']:\s*["\']?(\d+)["\']?'
            match = re.search(pattern, response)
            if match:
                return int(match.group(1))
            else:
                return 0
        except Exception as e:
            return handle_exception(e)
        
    def calculate_cost(self, usage):
        try:
            cost = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / 1_000_000 + self.model_config["output_token_price"] * usage["completion_tokens"] / 1_000_000, 6)
            return cost
        except Exception as e:
            return handle_exception(e)
    
    def calculate_input_token_price(self, usage):
        try:
            price_input_token_1M = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / 1_000_000, 6)    
            return price_input_token_1M
        except Exception as e:
            return handle_exception(e)
    
    def calculate_output_token_price(self, usage):
        try:
            price_output_token_1M = round(self.model_config["output_token_price"] * usage["completion_tokens"] / 1_000_000, 6)
            return price_output_token_1M
        except Exception as e:
            return handle_exception(e)
        
    def validate_params(self, data):
        try:
            params = {
                "temperature": (data.get("temperature"), self.model_config["temperature_min"], self.model_config["temperature_max"]),
                "top_p": (data.get("top_p"), self.model_config["top_p_min"], self.model_config["top_p_max"]),
            }
            for param, (value, min_val, max_val) in params.items():
                if value is not None and not (min_val <= value <= max_val):
                    return {"status": False, "message": f"Invalid {param} value"}
            return {"status": True}
        except Exception as e:
            log.error(e)
            return {"status": False, "message": error.VALIDATION_ERROR}
    
    def get_default_params(self, data):
        return {
            "model": data.get("ai_model"),
            "messages": data.get("message_history", []) + data.get("prompt", []),
            "temperature": data.get("temperature", 0),
            "frequency_penalty": data.get("frequency_penalty", 0),
            "presence_penalty": data.get("presence_penalty", 0),
            "top_p": data.get("top_p", 1),
            "max_tokens": data.get("max_tokens", self.model_config["max_tokens_default"])
        }
    
    def get_model_message(self, messages, data):
        try:
            new_message = []
            new_message = [
                {"parts": msg["content"], "role": "model" if msg["role"] in ["system", "assistant", "model"] else "user"}
                for msg in messages
            ]
            return new_message
        except Exception as e:
            log.error(e)
            return []
    
    def build_instruction(self, data, messages):
        try:
            instruction = (
            "Please provide a score for the previous user message. Use the following rubric:" 
            + str(data.get("rubric")) 
            + " Output your response as JSON, using this format: "
            + "{ '[criteria 1]': '[score 1]', '[criteria 2]': '[score 2]', 'total': '[sum of all scores of all criteria]' }."
            + " Make sure to include the 'total' key and its value in your response."
            )
            messages.append({"role": "model", "parts": instruction})
            return messages
        except Exception as e:
            log.error(e)

class ClaudeModel(BaseAIModel):
    def __init__(self, api_key, model_config):
        super().__init__(api_key, model_config)
        self.client = Anthropic(api_key = api_key)

    def get_response(self, api_params):
        try:
            response = self.client.messages.create(
            max_tokens = api_params["max_tokens"],
            messages = api_params["messages"], 
            model = api_params["model"],
            temperature = api_params["temperature"],
            top_p = api_params["top_p"],
            ),             
            message_data = response[0]
            ai_response = message_data.content[0].text
            usage = message_data.usage
            calculation = {"completion_tokens": usage.output_tokens, "prompt_tokens": usage.input_tokens, "total_tokens": usage.input_tokens + usage.output_tokens,}
            return {
                "completion_tokens": usage.output_tokens,
                "prompt_tokens": usage.input_tokens,
                "total_tokens": usage.input_tokens + usage.output_tokens,
                "ai_response": ai_response,
                "cost": self.calculate_cost(calculation),
                "price_input_token_1M": self.calculate_input_token_price(calculation),
                "price_output_token_1M": self.calculate_output_token_price(calculation)
            }
        except Exception as e:
            return handle_exception(e)

    def score_response(self, api_params, minimum_score):
        try:
            response = self.client.messages.create(
            max_tokens = api_params["max_tokens"],
            messages = api_params["messages"], 
            model = api_params["model"],
            temperature = api_params["temperature"],
            top_p = api_params["top_p"],
            ),             
            message_data = response[0]
            ai_score = message_data.content[0].text
            usage = message_data.usage
            score_result = False
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
            return {
                    "completion_tokens": usage.output_tokens,
                    "prompt_tokens": usage.input_tokens,
                    "total_tokens": usage.output_tokens + usage.input_tokens,
                    "ai_score": ai_score,
                    "score_result": score_result
            }
        except Exception as e:
            return handle_exception(e)

    def extract_score(self, response):
        try:
            pattern = r'"total":\s*"?(\d+)"?'
            match = re.search(pattern, response)
            if match:
                return int(match.group(1))
            else:
                return 0
        except Exception as e:
            return handle_exception(e)
        
    def calculate_cost(self, usage):
        try:
            cost = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / 1_000_000 + self.model_config["output_token_price"] * usage["completion_tokens"] / 1_000_000, 6)
            return cost
        except Exception as e:
            return handle_exception(e)
    
    def calculate_input_token_price(self, usage):
        try:
            price_input_token_1M = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / 1_000_000, 6)    
            return price_input_token_1M
        except Exception as e:
            return handle_exception(e)
    
    def calculate_output_token_price(self, usage):
        try:
            price_output_token_1M = round(self.model_config["output_token_price"] * usage["completion_tokens"] / 1_000_000, 6)
            return price_output_token_1M
        except Exception as e:
            return handle_exception(e)
        
    def validate_params(self, data):
        try:
            params = {
                "temperature": (data.get("temperature"), self.model_config["temperature_min"], self.model_config["temperature_max"]),
                "top_p": (data.get("top_p"), self.model_config["top_p_min"], self.model_config["top_p_max"]),
            }
            for param, (value, min_val, max_val) in params.items():
                if value is not None and not (value == -1 or (min_val <= value <= max_val)):
                    return {"status": False, "message": f"Invalid {param} value"}
            return {"status": True}
        except Exception as e:
            log.error(e)
            return {"status": False, "message": error.VALIDATION_ERROR}
    
    def get_default_params(self, data):
        return {
            "model": data.get("ai_model"),
            "messages": data.get("message_history", []) + data.get("prompt", []),
            "temperature": data.get("temperature", 0),
            "frequency_penalty": data.get("frequency_penalty", 0),
            "presence_penalty": data.get("presence_penalty", 0),
            "top_p": data.get("top_p", 1),
            "max_tokens": data.get("max_tokens", self.model_config["max_tokens_default"])
        }
    
    def get_model_message(self, messages, data):
        try:
            new_message = []
            if (data.get('prompt') or data.get('message_history')) and messages[0]["role"] != "user":
                new_message.append(AIModelVariables.CLAUDE_USER_DUMMY_MESSAGE_FIRST)

            new_message.extend(
                {"content": msg["content"], "role": "assistant" if msg["role"] in ["system", "assistant", "model"] else "user"}
                for msg in messages
            )
            if new_message and new_message[-1]["role"] == "assistant":
                new_message.append(AIModelVariables.CLAUDE_USER_DUMMY_MESSAGE_LAST)

            return new_message
       
        except Exception as e:
            log.error(e)
            return []
        
    def build_instruction(self, data, messages):
        try:
            instruction = (
            "Please provide a score for the previous user message. Use the following rubric:" 
            + str(data.get("rubric")) 
            + " Output your response as JSON, using this format: "
            + "{ '[criteria 1]': '[score 1]', '[criteria 2]': '[score 2]', 'total': '[sum of all scores of all criteria]' }."
            + " Make sure to include the 'total' key and its value in your response."
            )
            if messages[-1]["role"] == "user":
                messages.append({"role": "assistant", "content": "What is the next instruction"})
                messages.append({"role": "user", "content": instruction})
            else:
                messages.append({"role": "user", "content": instruction})
            return messages
        except Exception as e:
            log.error(e)
        
   