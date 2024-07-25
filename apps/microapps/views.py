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

from apps.microapps.serializer import (
    MicroAppSerializer,
    MicroappUserSerializer,
    AssetsSerializer,
    AssetsMicroappSerializer,
    RunSerializer,
)
from apps.microapps.models import Microapp, MicroAppUserJoin, Run

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))


def handle_exception(e):
    log.error(e)
    return Response(
        {"error": "an unexpected error occurred", "status": status.HTTP_500_INTERNAL_SERVER_ERROR},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
    post=extend_schema(request=MicroAppSerializer, responses={200: MicroAppSerializer}),
)
class MicroAppList(APIView):
    def add_microapp_user(self, uid, microapp):
        try:
            data = {"role": "admin", "ma_id": microapp.id, "user_id": uid}
            serializer = MicroappUserSerializer(data=data)
            if serializer.is_valid():
                return serializer.save()
            return Response(
                {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
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
                {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
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
                {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
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
            serializer = MicroAppSerializer(data=request.data)
            if serializer.is_valid():
                microapp = serializer.save()
                self.add_microapp_user(uid=request.user.id, microapp=microapp)
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
    put=extend_schema(request=MicroAppSerializer, responses={200: MicroAppSerializer}),
)
class MicroAppDetails(APIView):
    def get_object(self, pk):
        try:
            return Microapp.objects.get(id=pk)
        except Microapp.DoesNotExist:
            return None

    def get(self, request, pk, format=None):
        try:
            snippet = self.get_object(pk)
            if snippet:
                serializer = MicroAppSerializer(snippet)
                return Response(
                    {"data": serializer.data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "microapp not exist", "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)

    def put(self, request, pk, format=None):
        try:
            micro_apps = self.get_object(pk)
            if micro_apps:
                serializer = MicroAppSerializer(micro_apps, data=request.data)
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
                {"error": "microapp not exist", "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)

    def delete(self, request, pk, format=None):
        try:
            micro_apps = self.get_object(pk)
            if micro_apps:
                micro_apps.delete()
                return Response(status=status.HTTP_200_OK)
            return Response(
                {"error": "microapp not exist", "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)


class CloneMicroApp(APIView):
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
                    {"error": "microapp not exist", "status": status.HTTP_400_BAD_REQUEST},
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
                {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroappUserSerializer(many=True)}),
    post=extend_schema(request=MicroappUserSerializer, responses={200: MicroappUserSerializer}),
    put=extend_schema(request=MicroappUserSerializer, responses={201: MicroappUserSerializer}),
    delete=extend_schema(responses={200: MicroappUserSerializer(many=True)}),
)
class UserMicroApps(APIView):
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
                    {"error": "user not found", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            usermicroapps = MicroAppUserJoin.objects.filter(ma_id=app_id)
            serializer = MicroappUserSerializer(usermicroapps, many=True)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)

    def post(self, request, app_id, user_id, format=None):
        try:
            data = {"ma_id": app_id, "user_id": user_id, "role": request.data.get("role")}
            serializer = MicroappUserSerializer(data=data)
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
        except Exception as e:
            return handle_exception(e)

    def put(self, request, app_id, user_id, format=None):
        try:
            role = request.data.get("role")
            current_user = request.user.id
            current_user_role = self.get_object(current_user, app_id)

            if current_user_role:
                current_user_role_dict = model_to_dict(current_user_role)
                if current_user_role_dict["role"] == "admin":
                    userapp = self.get_object(user_id, app_id)
                    user_app_role = model_to_dict(userapp)
                    user_app_role["role"] = role
                    serializer = MicroappUserSerializer(userapp, data=user_app_role)
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
                    {"error": "Operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"error": "Operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception as e:
            return handle_exception(e)

    def delete(self, request, app_id, user_id, format=None):
        try:
            current_user = request.user.id
            current_user_role = self.get_object(current_user, app_id)
            if user_id and current_user_role:
                current_user_role_dict = model_to_dict(current_user_role)
                if current_user_role_dict["role"] == "admin":
                    userapp = self.get_object(user_id, app_id)
                    if userapp:
                        userapp.delete()
                        return Response(status=status.HTTP_200_OK)
                    return Response(
                        {"error": "microapp not found", "status": status.HTTP_404_NOT_FOUND},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                return Response(
                    {"error": "Operation not allowed", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"error": "user_id not found", "status": status.HTTP_404_NOT_FOUND},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: MicroAppSerializer(many=True)}),
)
class UserApps(APIView):
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

    client = OpenAI(api_key=env("OPENAI_API_KEY", default="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"))

    def check_api_params(self, data):
        try:
            params = {
                "temperature": (data.get("temperature"), 0, 2),
                "frequency_penalty": (data.get("frequency_penalty"), -2, 2),
                "presence_penalty": (data.get("presence_penalty"), -2, 2),
                "top_p": (data.get("top_p"), 0, 1),
            }

            for param, (value, min_val, max_val) in params.items():
                if value is not None and not (min_val <= value <= max_val):
                    return {"status": False, "message": f"Invalid {param} value"}

            return {"status": True}
        except Exception as e:
            log.error(e)        

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
            for field in required_fields:
                if data.get(field) is None:
                    return False

            if data.get("scored_run") and (data.get("minimum_score") is None or data.get("rubric") is None):
                return False

            return True
        except Exception as e:
            log.error(e)
    
    def extract_score(self,text):
        pattern = r'"total":\s*"?(\d+)"?'
        match = re.search(pattern, text)
        if match:
            return int(match.group(1))
        else:
            return 0

    def get_ai_model_specific_config(self, api_param, model_name, score):
        if "gpt" in model_name and score:
            return self.score_phase(api_param)
        elif "gpt" in  model_name and not score:
            return self.default_gpt_phase(api_param)
        elif "gemini" in model_name and score:
            pass
        elif "gemini" in model_name and not score:
            pass

    def default_gpt_phase(self, api_params):
        try:
            response = self.client.chat.completions.create(**api_params)
            usage = response.usage
            ai_response = response.choices[0].message.content
            return {
                "completion_tokens": usage.completion_tokens,
                "prompt_tokens": usage.prompt_tokens,
                "total_tokens": usage.total_tokens,
                "ai_response": ai_response,
            }
        except Exception as e:
            log.error(e)

    def skip_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "You skipped this phase"}

    def no_submission_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "No submission"}

    def hard_coded_phase(self):
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": ""}

    def score_phase(self, api_params):
        response = self.client.chat.completions.create(**api_params)
        ai_response = response.choices[0].message.content
        return ai_response

    def post(self, request, format=None):
        try:
            print(f"User: {request.user}, Authenticated: {request.user.is_authenticated}")
            data = request.data
            if not self.check_payload(data):
                return Response(
                    {"error": "Invalid payload fields missing", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ai_validation = self.check_api_params(data) 
            if not ai_validation["status"]:
                return Response(
                    {"error": ai_validation["message"], "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            api_params = {
                "model": data.get("ai_model", "gpt-3.5-turbo"),
                "messages": data.get("message_history", []) + data.get("prompt", []),
                "temperature": data.get("temperature", 0),
                "frequency_penalty": data.get("frequency_penalty", 0),
                "presence_penalty": data.get("presence_penalty", 0),
                "top_p": data.get("top_p", 1),
            }
            if max_tokens := data.get("max_ftokens"):
                api_params["max_tokens"] = max_tokens

            score = ""

            if data.get("skippable_phase"):
                response = self.skip_phase()
            elif data.get("no_submission") and data.get("prompt") is None:
                response = self.hard_coded_phase()
            elif data.get("no_submission"):
                response = self.no_submission_phase()
            elif data.get("scored_run"):
                response = self.get_ai_model_specific_config(api_params, api_params["model"], False)
                instruction = """Please provide a score for the previous user message. Use the following rubric:
                """ + data.get("rubric") + """
                Please output your response as JSON, using this format: { "[criteria 1]": "[score 1]", "[criteria 2]": "[score 2]", "total": "[total score]" }"""
                api_params["messages"].append({"role": "system", "content": instruction})
                score = self.get_ai_model_specific_config(api_params, api_params["model"], True)
                api_params["messages"].pop()
            else:
                response = self.get_ai_model_specific_config(api_params, api_params["model"], False)

            usage = response
            cost = round(0.5 * usage["prompt_tokens"] / 1_000_000 + 1.5 * usage["completion_tokens"] / 1_000_000, 6)
            if not (session_id := data.get("session_id")):
                session_id = uuid.uuid4()

            run_data = {
                "ma_id": data["ma_id"],
                "user_id": data["user_id"],
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": str(session_id),
                "satisfaction": 0,
                "prompt": api_params["messages"],
                "response": usage["ai_response"],
                "credits": 0,
                "cost": cost,
                "no_submission": data["no_submission"],
                "ai_model": api_params["model"],
                "temperature": api_params["temperature"],
                "max_tokens": data.get("max_tokens"),
                "top_p": api_params["top_p"],
                "frequency_penalty": api_params["frequency_penalty"],
                "presence_penalty": api_params["presence_penalty"],
                "input_tokens": usage["prompt_tokens"],
                "output_tokens": usage["completion_tokens"],
                "price_input_token_1M": round(0.5 * usage["prompt_tokens"] / 1_000_000, 6),
                "price_output_token_1M": round(1.5 * usage["completion_tokens"] / 1_000_000, 6),
                "scored_run": data["scored_run"],
                "run_score": score,
                "minimum_score": data.get("minimum_score"),
                "rubric": data.get("rubric"),
                "run_passed": True,
                "skippable_phase": data.get("skippable_phase")
            }
            serializer = RunSerializer(data=run_data)
            if serializer.is_valid():
                serialize = serializer.save()
                run_data["id"] = serialize.id
                #for hardcoded response
                if(usage["ai_response"] == ""):
                    return Response(
                    {"data": [], "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
                return Response(
                    {"data": run_data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
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
