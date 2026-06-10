"""
AI model execution views - Run models and handle AI interactions.
"""
import copy
import datetime
import uuid
import os
import json
import asyncio
from pathlib import Path
import logging as log
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from django.http import StreamingHttpResponse, QueryDict
from asgiref.sync import sync_to_async

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import RunUsage, GuestUsage, get_user_ip
from apps.utils.global_variables import MicroappVariables, UsageVariables
from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.models import Microapp, MicroAppUserJoin, Run, DocumentChunk, AppFileReference
from apps.microapps.rubric_publish import ensure_rubric_version_for_scored_run
from apps.microapps.score_utils import (
    coerce_run_score_to_dict,
    format_run_score_feedback_from_rationales,
    parse_partial_run_score,
    parse_run_score_total,
)
from apps.microapps.rag_service import retrieve_relevant_chunks_multi_file
from apps.microapps.serializer import (
    MicroAppSerializer,
    MicroappUserSerializer,
    RunPostSerializer,
    RunGetSerializer,
    RunPatchSerializer
)
from apps.users.models import CustomUser
from apps.users.serializers import UserSerializer
from django.utils import timezone
from django.db.models import F
from django.conf import settings
import environ
from ..llm_interface import UnifiedLLMInterface
from ..streaming import litellm_sse_generator
from .mixins import handle_exception, UsageTrackingMixin

# Environment setup
BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))


def enforce_owner_credits_for_run(view_self, app_owner_id, request, ip):
    """
    Block runs when guest limits are exceeded or the app owner has no credits.
    Returns a DRF Response to return early, or None if the run may proceed.
    """
    if not request.user.id:
        if not GuestUsage.check_usage_limit(view_self, ip):
            return Response(error.RUN_USAGE_LIMIT_EXCEED, status=status.HTTP_400_BAD_REQUEST)
        audience = "public"
    else:
        audience = "owner"

    credits_check = RunUsage.check_for_available_credits(
        view_self, app_owner_id, None, audience=audience
    )
    if not credits_check.get("has_credits"):
        return Response(
            {
                "error": credits_check["message"],
                "status": credits_check.get("status"),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


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
    post=extend_schema(request=RunPostSerializer, responses={200: RunGetSerializer}),
    patch=extend_schema(request=RunPatchSerializer, responses={200: RunGetSerializer}, summary='Also add "id" in request payoad while calling PATCH API')
)
class RunList(APIView, UsageTrackingMixin):
    permission_classes = [AllowAny]
    ai_score = ""

    @staticmethod
    def _copy_and_set_is_preview(request):
        """Build a mutable request body with a server-validated is_preview flag."""
        raw = request.data
        if isinstance(raw, QueryDict):
            data = raw.dict()
        elif isinstance(raw, dict):
            data = {**raw}
        else:
            data = {k: raw[k] for k in raw}
        data["is_preview"] = RunList._resolve_is_preview(request, data)
        return data

    @staticmethod
    def _resolve_is_preview(request, data):
        """
        Client may set is_preview; only allow True when the caller is an owner
        or admin of the microapp (e.g. builder Preview tab). Public/student runs cannot opt out of stats this way.
        """
        if not data.get("is_preview"):
            return False
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        ma_id = data.get("ma_id")
        if ma_id is None:
            return False
        try:
            ma_id = int(ma_id)
        except (TypeError, ValueError):
            return False
        return MicroAppUserJoin.objects.filter(
            ma_id=ma_id,
            user_id=user.id,
            role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN],
        ).exists()

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [AllowAny()]
    score_result = True
    app_hash_id = ""
    response_type = ""
    credits = 0
    _final_api_messages = None

    def _snapshot_final_api_messages(self, api_params: dict) -> None:
        """Store the exact messages payload sent to the LLM (pre-scoring mutations)."""
        messages = api_params.get("messages") or []
        self._final_api_messages = copy.deepcopy(messages)

    def _api_messages_for_response(self) -> list:
        return self._final_api_messages if self._final_api_messages is not None else []

    def _done_payload_extras(self) -> dict:
        return {"api_messages": self._api_messages_for_response()}

    def check_payload(self, data, request):
        """Validate request payload based on authentication status."""
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
        """Format API response data for database storage."""
        try:
            usage = response
            if not (session_id := data.get("session_id")):
                session_id = uuid.uuid4()
            
            credits = response["credits"]
            self.credits = credits  # Store for later use in update_user_credits

            # Ensure max_tokens is set from api_params if not in data
            max_tokens = data.get("max_tokens", api_params.get("max_tokens", 0))
            app_hash_id = self.app_hash_id or data.get("app_hash_id", '')

            # Use `rubric_version` (model FK name). `rubric_version_id` is ignored by
            # RunGetSerializer, so the DB column was never set and stayed NULL.
            # Real scored runs auto-publish a new RubricVersion when app_json gates
            # differ from the active snapshot (preview runs use current active only).
            active_rv_pk = None
            mid = data.get("ma_id")
            if mid is not None:
                try:
                    mid_int = int(mid)
                except (TypeError, ValueError):
                    mid_int = None
                if (
                    mid_int is not None
                    and data.get("scored_run")
                    and not data.get("is_preview")
                ):
                    active_rv_pk = ensure_rubric_version_for_scored_run(mid_int)
                if active_rv_pk is None:
                    pk_lookup = mid_int if mid_int is not None else mid
                    active_rv_pk = Microapp.objects.filter(pk=pk_lookup).values_list(
                        "active_rubric_version_id", flat=True
                    ).first()

            run_data = {
                "ma_id": int(data.get("ma_id")),
                "user_id": data.get("user_id"),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": str(session_id),
                "satisfaction": 0,
                "api_messages": self._api_messages_for_response(),
                "no_submission": data.get("no_submission", False),
                "ai_model": api_params.get("model", ""),
                "temperature": float(api_params.get("temperature")) if api_params.get("temperature") is not None else None,
                "max_tokens": max_tokens,
                "scored_run": data.get("scored_run", False),
                "run_score": self.ai_score,
                "minimum_score": data.get("minimum_score", 0.0),
                "rubric": str(data.get("rubric", "none")),
                "run_passed": self.score_result,
                "request_skip": data.get("request_skip", False),
                "credits": credits,
                "cost": usage["cost"],
                "response": usage["ai_response"],
                "input_tokens": usage["prompt_tokens"],
                "output_tokens": usage["completion_tokens"],
                "owner_id": app_owner_id,
                "user_ip": ip,
                "system_prompt": data.get("system_prompt", {}),
                "phase_instructions": data.get("phase_instructions", {}),
                "phase_title": str(data.get("phase_title", "") or "")[:255],
                "is_chat_run": bool(data.get("is_chat_run", False)),
                "is_preview": bool(data.get("is_preview", False)),
                "rubric_version": active_rv_pk,
                "user_prompt": data.get("user_prompt", {}),
                "app_hash_id": app_hash_id,
                "response_type": self.response_type,
                "run_uuid": data.get("run_uuid"),
                "litellm_response_id": usage.get("litellm_response_id")
            }
            return run_data
        except Exception as e:
            log.error(e)
            log.error(f"Response data: {response}")
            raise

    def _inject_rag_context(self, messages: list, ma_data, user_prompt: str) -> list:
        """
        Retrieve relevant chunks for each sidebar file and prepend them as a
        context message before the conversation history.
        No-ops silently if the app has no attached files or chunks aren't ready.
        """
        try:
            app_json = ma_data.app_json or {}
            if isinstance(app_json, str):
                app_json = json.loads(app_json) if app_json else {}
            attached_files = app_json.get("attachedFiles", [])
            if not attached_files or not user_prompt:
                return messages

            file_names = [f["original_filename"] for f in attached_files if f.get("original_filename")]
            if not file_names:
                return messages

            # Check that at least one file has chunks stored
            if not DocumentChunk.objects.filter(
                file_source__app_references__app=ma_data,
                file_source__file_name__in=file_names,
            ).exists():
                log.warning("RAG: no chunks found for microapp=%s files=%s", ma_data.id, file_names)
                return messages

            results = retrieve_relevant_chunks_multi_file(
                microapp_id=ma_data.id,
                file_names=file_names,
                query=user_prompt,
                top_k_total=10,
            )

            sections = []
            for f in attached_files:
                fname = f.get("original_filename", "")
                chunks = results.get(fname, [])
                if not chunks:
                    continue
                description = f.get("description", "")
                chunk_text = "\n\n---\n\n".join(c for c, _ in chunks)
                section = f"File: {fname}"
                if description:
                    section += f"\nDescription: {description}"
                section += f"\n============\n{chunk_text}\n============"
                sections.append(section)

            if not sections:
                return messages

            context_message = {
                "role": "user",
                "content": "Context Documents:\n\n" + "\n\n".join(sections),
            }

            # Insert context as the first user message (before conversation history)
            return [context_message] + list(messages)

        except Exception as e:
            log.error("RAG inject error for microapp=%s: %s", ma_data.id, e)
            return messages

    def skip_phase(self):
        """Handle skip phase response."""
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "You skipped this phase", "cost": 0, "credits": 0}

    def no_submission_phase(self):
        """Handle no submission phase response."""
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "No submission", "cost": 0, "credits": 0}

    def fixed_response_phase(self, fixed_response):
        """Handle fixed response phase."""
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": fixed_response, "cost": 0, "credits": 0}

    def save_streaming_run_data(self, response_data, data, api_params, model, app_owner_id, ip, user_id):
        """Save streaming run data to database after stream completion (sync version)"""
        try:
            self.response_type = MicroappVariables.DEFAULT_RESPONSE_TYPE
            run_data = self.route_api_response(
                response_data, data, api_params, model, app_owner_id, ip)

            serializer = RunGetSerializer(data=run_data)
            if serializer.is_valid():
                serialize = serializer.save()
                self.update_user_credits(serialize.id, app_owner_id, user_id)
                
                return {
                    "run_uuid": run_data.get("run_uuid"),
                    "credits": run_data.get("credits", 0),
                    "cost": float(run_data.get("cost", 0)),
                    "run_score": self.ai_score,
                    "run_passed": self.score_result,
                    "api_messages": run_data.get("api_messages", []),
                }
            else:
               log.error(f"Streaming run serialization failed: {serializer.errors}")
               raise ValueError(f"Invalid run data: {serializer.errors}")
        except Exception as e:
            log.error(f"Error saving streaming run data: {e}")
            raise

    def post(self, request, format=None):
        """Execute AI model run."""
        try:
            data = self._copy_and_set_is_preview(request)
            # Convert numeric fields to appropriate types
            if data.get("temperature"):
                data["temperature"] = float(data.get("temperature"))
            if data.get("minimum_score"):
                data["minimum_score"] = float(data.get("minimum_score"))
            if data.get("max_tokens"):
                data["max_tokens"] = int(data.get("max_tokens"))
            if data.get("transcription_cost"):
                data["transcription_cost"] = float(data.get("transcription_cost"))

            if 'cost' in data:
                # Round cost to 6 decimal places before serializer
                data['cost'] = round(float(data['cost']), 6)
            
            # Check for mandatory keys in the user request payload
            if not self.check_payload(data, request):    
                return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ip = get_user_ip(request)
            
            # Always resolve microapp owner and app hash for billing/statistics
            app_owner = MicroAppUserJoin.objects.get(ma_id=data.get("ma_id"), role="owner")
            app_owner_id = MicroappUserSerializer(app_owner).data["user_id"]
            ma_data = Microapp.objects.get(id=data.get("ma_id"))
            self.app_hash_id = MicroAppSerializer(ma_data).data["hash_id"]
            
            blocked = enforce_owner_credits_for_run(self, app_owner_id, request, ip)
            if blocked:
                return blocked

            # Return model instance based on AI-model name
            requested_model = data.get("model", env("DEFAULT_AI_MODEL"))
            model_router = AIModelRoute().get_ai_model(requested_model)
           
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

            # RAG injection: prepend relevant file chunks as context
            api_params["messages"] = self._inject_rag_context(
                messages=api_params["messages"],
                ma_data=ma_data,
                user_prompt=data.get("user_prompt", ""),
            )
            self._snapshot_final_api_messages(api_params)

            # Add transcription cost to api_params before get_response
            api_params["transcription_cost"] = float(data.get("transcription_cost", 0))

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
                # Check if model supports streaming
                model_config = model_router["config"]
                if model_config.get("stream", True):
                    api_params["stream"] = True
                    
                    def save_streaming_scored_run(response_data):
                        """Callback for streaming scored runs"""
                        try:
                            # Get scoring for the completed response
                            api_params["messages"] = model.build_instruction(data, api_params["messages"])
                            api_params["stream"] = False  # Force non-streaming for scoring
                            score_response = model.score_response(api_params, data.get("minimum_score"))
                            self.ai_score = score_response["ai_score"]
                            self.score_result = score_response["score_result"]
                            
                            # Combine response and score data
                            combined_data = response_data.copy()
                            combined_data.update({
                                "prompt_tokens": response_data["prompt_tokens"] + score_response["prompt_tokens"],
                                "completion_tokens": response_data["completion_tokens"] + score_response["completion_tokens"],
                                "cost": round(response_data["cost"] + score_response["cost"], 6),
                                "credits": response_data["credits"] + score_response["credits"],
                            })
                            
                            self.save_streaming_run_data(combined_data, data, api_params, model, app_owner_id, ip, request.user.id if request.user.id else None)
                            
                            return {
                                "run_score": self.ai_score,
                                "run_passed": self.score_result,
                                "minimum_score": data.get("minimum_score"),
                                "rubric": data.get("rubric"),
                                "scored_run": True,
                                "cost": float(combined_data["cost"]),
                                "credits": combined_data["credits"],
                                **self._done_payload_extras(),
                            }
                        except Exception as e:
                            log.error(f"Error in streaming scored run callback: {e}")
                            raise
                    
                    # Use streaming for scored runs
                    generator = litellm_sse_generator(model, api_params, on_completion_callback=save_streaming_scored_run)
                    response = StreamingHttpResponse(generator, content_type="text/event-stream")
                    response['X-Accel-Buffering'] = 'no'
                    response['Cache-Control'] = 'no-cache'
                    return response
                else:
                    # Use non-streaming for scored runs
                    api_params["stream"] = False
                    response = model.get_response(api_params)
                    if not response["status"]:
                        return Response({"error": error.INVALID_PAYLOAD, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
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
                        "cost": round(response["cost"] + score_response["cost"], 6),
                    })
                    response.update({
                        "credits": response["credits"] + score_response["credits"],
                    })
                    self.response_type = MicroappVariables.DEFAULT_RESPONSE_TYPE
            # Handle basic feedback phase
            else:
                # Check if model supports streaming
                model_config = model_router["config"]
                if model_config.get("stream", True):
                    api_params["stream"] = True
                    
                    def save_streaming_run(response_data):
                        """Callback that works for both sync and async generators"""
                        try:
                            return self.save_streaming_run_data(response_data, data, api_params, model, app_owner_id, ip, request.user.id if request.user.id else None)
                        except Exception as e:
                            log.error(f"Error in streaming callback: {e}")
                            raise
                    
                    # Use async generator for both development and production
                    generator = litellm_sse_generator(model, api_params, on_completion_callback=save_streaming_run)
                    response = StreamingHttpResponse(generator, content_type="text/event-stream")
                    response['X-Accel-Buffering'] = 'no'
                    response['Cache-Control'] = 'no-cache'
                    return response
                else:
                    # Use non-streaming response
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
            return Response(error.MICROAPP_NOT_EXIST, status=status.HTTP_400_BAD_REQUEST)
       
        except CustomUser.DoesNotExist:
            return Response(error.USER_NOT_EXIST, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            return handle_exception(e)

    def get(self, request, *args, **kwargs):
        """Get runs with optional filtering."""
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
        """Update run data."""
        try:
            data = request.data
            
            if 'cost' in data:
                # Round cost to 6 decimal places before serializer
                data['cost'] = round(float(data['cost']), 6)
            
            if self.checkPatchPayload(data):
                id_value = data.get("id")
                del data["id"]
                
                # Update the run with the matching run_uuid
                run_object = Run.objects.get(run_uuid=id_value)
                
                # If cost or credits are being updated, we need to handle credit deduction
                if 'cost' in data or 'credits' in data:
                    # Get the app owner ID
                    app_owner = MicroAppUserJoin.objects.get(ma_id=run_object.ma_id, role="owner")
                    app_owner_id = app_owner.user_id.id
                    
                    # Calculate the difference in credits
                    old_credits = run_object.credits
                    print("OLD CREDITS", old_credits)
                    
                    # If only cost is provided, calculate new credits from cost
                    if 'cost' in data and 'credits' not in data:
                        # For TTS operations, we can directly calculate credits from cost
                        # Using the standard credit calculation (1 credit = $0.0001)
                        new_credits = max(int(float(data['cost']) * UsageVariables.CREDITS_MULTIPLIER), UsageVariables.MINIMUM_CREDITS)
                        # Add the new credits to the data that will be saved
                        data['credits'] = new_credits
                    else:
                        new_credits = data.get('credits', old_credits)

                    print("NEW CREDITS", new_credits)
                    
                    credits_diff = new_credits - old_credits

                    print("CREDITS DIFF", credits_diff)
                    
                    if credits_diff > 0:
                        # Update the credits field to track the difference
                        self.credits = credits_diff
                        # Deduct the additional credits
                        self.update_user_credits(run_object.id, app_owner_id, request.user.id if request.user.id else None)
                
                serializer = RunPatchSerializer(run_object, data=data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    return Response(
                        {"data": serializer.data, "status": status.HTTP_200_OK},
                        status=status.HTTP_200_OK,
                    )
                else:
                    return Response(
                        {"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                return Response(
                    {"error": "Invalid payload", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Run.DoesNotExist:
            return Response(
                {"error": "Run not found", "status": status.HTTP_404_NOT_FOUND},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"error": str(e), "status": status.HTTP_500_INTERNAL_SERVER_ERROR},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    def checkPatchPayload(self, data):
        """Validate patch payload."""
        try:
            if not data.get("id"):
                return False
            immutable_fields = ["ma_id", "user_id", "user_ip", "owner_id", "app_hash_id", "is_preview"]
            for field in immutable_fields:
                if data.get(field):
                    return False
            return True
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(
        responses={200: RunGetSerializer},
        summary="Get a run record by run_uuid (e.g. for e2e test verification)",
    ),
)
class RunDetailByUuid(APIView):
    """Return a single run by run_uuid. Used by e2e tests to verify runs were persisted."""
    permission_classes = [AllowAny]

    def get(self, request, run_uuid, *args, **kwargs):
        try:
            run_uuid = (run_uuid or "").strip()
            run = Run.objects.filter(run_uuid__iexact=run_uuid).first()
            if not run:
                return Response(
                    {"error": "Run not found", "status": status.HTTP_404_NOT_FOUND},
                    status=status.HTTP_404_NOT_FOUND,
                )
            serializer = RunGetSerializer(run)
            return Response(
                {"data": serializer.data, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    post=extend_schema(request=RunPostSerializer, responses={200: RunGetSerializer}, summary="Score a response and stream explanation")
)
class ScoreRunList(RunList):
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        """Score a run and stream a user-friendly explanation."""
        try:
            data = self._copy_and_set_is_preview(request)
            # Convert numeric fields to appropriate types
            if data.get("temperature"):
                data["temperature"] = float(data.get("temperature"))
            if data.get("minimum_score"):
                data["minimum_score"] = float(data.get("minimum_score"))
            if data.get("max_tokens"):
                data["max_tokens"] = int(data.get("max_tokens"))
            if data.get("transcription_cost"):
                data["transcription_cost"] = float(data.get("transcription_cost"))

            if 'cost' in data:
                # Round cost to 6 decimal places before serializer
                data['cost'] = round(float(data['cost']), 6)

            # Check for mandatory keys in the user request payload
            if not self.check_payload(data, request):
                return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not data.get("scored_run"):
                return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ip = get_user_ip(request)

            # Always resolve microapp owner and app hash for billing/statistics
            app_owner = MicroAppUserJoin.objects.get(ma_id=data.get("ma_id"), role="owner")
            app_owner_id = MicroappUserSerializer(app_owner).data["user_id"]
            ma_data = Microapp.objects.get(id=data.get("ma_id"))
            self.app_hash_id = MicroAppSerializer(ma_data).data["hash_id"]

            blocked = enforce_owner_credits_for_run(self, app_owner_id, request, ip)
            if blocked:
                return blocked

            # Return model instance based on AI-model name
            requested_model = data.get("model", env("DEFAULT_AI_MODEL"))
            model_router = AIModelRoute().get_ai_model(requested_model)

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

            api_params["messages"] = self._inject_rag_context(
                messages=api_params["messages"],
                ma_data=ma_data,
                user_prompt=data.get("user_prompt", ""),
            )
            self._snapshot_final_api_messages(api_params)

            # Add transcription cost to api_params before get_response
            api_params["transcription_cost"] = float(data.get("transcription_cost", 0))

            # Handle skip phase
            if data.get("request_skip"):
                response = self.skip_phase()
                self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            elif data.get("fixed_response"):
                response = self.fixed_response_phase(data.get("fixed_response"))
                self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            elif data.get("no_submission"):
                response = self.no_submission_phase()
                self.response_type = MicroappVariables.FIXED_RESPONSE_TYPE
            else:
                explanation_requested = data.get("score_explanation", True)
                explanation_mode = data.get("score_explanation_mode", "always")
                feedback_enabled_raw = data.get("score_feedback_enabled", True)
                feedback_enabled = (
                    str(feedback_enabled_raw).lower() not in {"false", "0", "off", "no"}
                    if isinstance(feedback_enabled_raw, str)
                    else bool(feedback_enabled_raw)
                )
                feedback_instructions = str(
                    data.get("score_feedback_instructions", "") or ""
                )
                include_overall_feedback = feedback_enabled
                minimum_score = float(data.get("minimum_score") or 0)

                def _serialized_run_score(value) -> str:
                    if isinstance(value, (dict, list)):
                        return json.dumps(value)
                    return str(value)

                def _score_event_payload(
                    run_score_value,
                    *,
                    partial: bool = False,
                    run_passed=None,
                ) -> dict:
                    payload = {
                        "run_score": _serialized_run_score(run_score_value),
                        "minimum_score": data.get("minimum_score"),
                        "rubric": data.get("rubric"),
                        "scored_run": True,
                        "score_explanation": explanation_requested,
                        "score_explanation_mode": explanation_mode,
                        "score_feedback_enabled": feedback_enabled,
                        "score_feedback_instructions": feedback_instructions,
                    }
                    if partial:
                        payload["partial"] = True
                    if run_passed is not None:
                        payload["run_passed"] = run_passed
                    return payload

                def _usage_from_model() -> dict:
                    if isinstance(model.last_usage, dict):
                        return {
                            "prompt_tokens": model.last_usage.get("prompt_tokens", 0),
                            "completion_tokens": model.last_usage.get("completion_tokens", 0),
                            "total_tokens": model.last_usage.get("total_tokens", 0),
                        }
                    return {
                        "prompt_tokens": getattr(model.last_usage, "prompt_tokens", 0) if model.last_usage else 0,
                        "completion_tokens": getattr(model.last_usage, "completion_tokens", 0) if model.last_usage else 0,
                        "total_tokens": getattr(model.last_usage, "total_tokens", 0) if model.last_usage else 0,
                    }

                score_messages = model.build_instruction(
                    data,
                    list(api_params["messages"]),
                    include_overall_feedback=include_overall_feedback,
                )
                score_params = api_params.copy()
                score_params["messages"] = score_messages

                model_config = model_router["config"]
                if model_config.get("stream", True):
                    async def score_stream_generator():
                        accumulated = ""
                        last_partial_key = None

                        for chunk in model.stream_score_response(
                            score_params, minimum_score
                        ):
                            accumulated += chunk
                            partial = parse_partial_run_score(accumulated)
                            if not partial:
                                await asyncio.sleep(0)
                                continue

                            partial_key = json.dumps(partial, sort_keys=True)
                            if partial_key == last_partial_key:
                                await asyncio.sleep(0)
                                continue
                            last_partial_key = partial_key

                            total = parse_run_score_total(partial)
                            run_passed = (
                                total >= minimum_score if total is not None else None
                            )
                            event = (
                                "score_progress"
                                if total is None
                                else "score"
                            )
                            # Always mark in-stream events as partial: the total can
                            # parse before trailing rationales / overall_rationale
                            # finish streaming, and dropping the flag early makes the
                            # UI leave its "scoring in progress" state too soon.
                            payload = _score_event_payload(
                                partial,
                                partial=True,
                                run_passed=run_passed,
                            )
                            yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"
                            await asyncio.sleep(0)

                        self.ai_score = model.ai_score
                        self.score_result = model.score_result

                        final_score_payload = _score_event_payload(
                            self.ai_score,
                            run_passed=self.score_result,
                        )
                        yield f"event: score\ndata: {json.dumps(final_score_payload)}\n\n"

                        usage = _usage_from_model()
                        score_dict = coerce_run_score_to_dict(self.ai_score)
                        ai_response = (
                            format_run_score_feedback_from_rationales(score_dict)
                            if score_dict
                            else ""
                        )
                        response_data = {
                            "ai_response": ai_response,
                            **usage,
                            "cost": model.last_cost if hasattr(model, "last_cost") else 0,
                            "credits": model.last_credits if hasattr(model, "last_credits") else 0,
                            "litellm_response_id": getattr(model, "litellm_response_id", None),
                        }

                        save_result = await sync_to_async(self.save_streaming_run_data)(
                            response_data,
                            data,
                            api_params,
                            model,
                            app_owner_id,
                            ip,
                            request.user.id if request.user.id else None,
                        )

                        done_payload = {
                            "run_score": _serialized_run_score(self.ai_score),
                            "run_passed": self.score_result,
                            "cost": response_data["cost"],
                            "credits": response_data["credits"],
                            "run_uuid": save_result.get("run_uuid") if save_result else data.get("run_uuid"),
                            "score_explanation": explanation_requested,
                            "score_explanation_mode": explanation_mode,
                            "score_feedback_enabled": feedback_enabled,
                            "score_feedback_instructions": feedback_instructions,
                            **self._done_payload_extras(),
                        }
                        if save_result and isinstance(save_result, dict):
                            done_payload["api_messages"] = save_result.get(
                                "api_messages", done_payload.get("api_messages", [])
                            )
                        yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

                    generator = score_stream_generator()
                    response = StreamingHttpResponse(generator, content_type="text/event-stream")
                    response['X-Accel-Buffering'] = 'no'
                    response['Cache-Control'] = 'no-cache'
                    return response

                score_params["stream"] = False
                score_response = model.score_response(score_params, minimum_score)
                if score_response.get("status") is False:
                    return Response(
                        {"error": score_response.get("message", error.INVALID_PAYLOAD), "status": status.HTTP_400_BAD_REQUEST},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                self.ai_score = score_response["ai_score"]
                self.score_result = score_response["score_result"]
                score_dict = coerce_run_score_to_dict(self.ai_score)
                ai_response = (
                    format_run_score_feedback_from_rationales(score_dict)
                    if score_dict
                    else ""
                )
                response = {
                    "ai_response": ai_response,
                    "prompt_tokens": score_response.get("prompt_tokens", 0),
                    "completion_tokens": score_response.get("completion_tokens", 0),
                    "total_tokens": score_response.get("total_tokens", 0),
                    "cost": score_response.get("cost", 0),
                    "credits": score_response.get("credits", 0),
                    "litellm_response_id": score_response.get("litellm_response_id"),
                }
                self.response_type = MicroappVariables.DEFAULT_RESPONSE_TYPE

            if isinstance(response, StreamingHttpResponse):
                return response

            # Create response data for non-streaming paths
            run_data = self.route_api_response(response, data, api_params, model, app_owner_id, ip)

            serializer = RunGetSerializer(data=run_data)
            if serializer.is_valid():
                serialize = serializer.save()
                self.update_user_credits(serialize.id, app_owner_id, request.user.id if request.user.id else None)
                run_data["id"] = serialize.id
                run_data["credits"] = self.credits

                return Response(
                    {"data": run_data, "status": status.HTTP_200_OK},
                    status=status.HTTP_200_OK,
                )
            return Response(
                error.validation_error(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MicroAppUserJoin.DoesNotExist:
            return Response(error.MICROAPP_NOT_EXIST, status=status.HTTP_400_BAD_REQUEST)

        except CustomUser.DoesNotExist:
            return Response(error.USER_NOT_EXIST, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    post=extend_schema(request=RunPostSerializer, responses={200: RunGetSerializer}, summary="Run a model anonymously without authentication")
)
class AnonymousRunList(RunList):
    permission_classes = [AllowAny]
    authentication_classes = []

    def check_payload(self, data, request):
        """Validate anonymous run payload."""
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
        """Execute anonymous AI model run."""
        try:
            data = self._copy_and_set_is_preview(request)
            # Convert numeric fields to appropriate types
            if data.get("temperature"):
                data["temperature"] = float(data.get("temperature"))
            if data.get("minimum_score"):
                data["minimum_score"] = float(data.get("minimum_score"))
            if data.get("max_tokens"):
                data["max_tokens"] = int(data.get("max_tokens"))
            if data.get("transcription_cost"):
                data["transcription_cost"] = float(data.get("transcription_cost"))
            
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
            
            # Always resolve microapp owner and app hash for billing/statistics
            app_owner = MicroAppUserJoin.objects.get(ma_id=data.get("ma_id"), role="owner")
            app_owner_id = MicroappUserSerializer(app_owner).data["user_id"]
            ma_data = Microapp.objects.get(id=data.get("ma_id"))
            self.app_hash_id = MicroAppSerializer(ma_data).data["hash_id"]
            
            blocked = enforce_owner_credits_for_run(self, app_owner_id, request, ip)
            if blocked:
                return blocked

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

            api_params["messages"] = self._inject_rag_context(
                messages=api_params["messages"],
                ma_data=ma_data,
                user_prompt=data.get("user_prompt", ""),
            )
            self._snapshot_final_api_messages(api_params)

            # Add transcription cost to api_params before get_response
            api_params["transcription_cost"] = float(data.get("transcription_cost", 0))

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
                    "cost": round(response["cost"] + score_response["cost"], 6),
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
    """Route AI model requests to appropriate handlers."""
   
    @staticmethod
    def get_ai_model(model_name):
        """Get AI model configuration and interface."""
        try:
            model_config = DynamicModelService.get_model_config(model_name)
            if not model_config:
                return False
            
            # Use the unified interface for all models
            return {"model": UnifiedLLMInterface(model_config), "config": model_config}
            
        except Exception as e:
           return handle_exception(e)

class LiteLLMModelConfigurations(APIView):
    permission_classes = [IsAuthenticated]

    def get_user_plan(self, user_id):
        """Get the user's current subscription plan (litellm access group)."""
        try:
            from apps.subscriptions.models import Subscription
            from apps.subscriptions.constants import tier_for_price

            subscription = (
                Subscription.objects.filter(user_id=user_id).order_by("-created_at").first()
            )
            price_id = subscription.price_id if subscription else None
            # Map the tier name to the lowercase litellm access group.
            return tier_for_price(price_id).name.lower()

        except Exception as e:
            log.error(f"Error getting user plan: {str(e)}")
            return "free"

    @extend_schema(
        responses={200: str},
        summary="Get available AI models from LiteLLM based on user's subscription plan"
    )
    def get(self, request, format=None):
        """Get available AI models from LiteLLM for user's plan."""
        try:
            import requests
            from django.conf import settings
            
            # Get user's current plan
            user_plan = self.get_user_plan(request.user.id)
            access_group = user_plan
            
            # Query LiteLLM for available models
            litellm_url = f"{settings.LITELLM_BASE_URL}/v1/model/info"
            headers = {
                'accept': 'application/json',
                'x-litellm-api-key': settings.LITELLM_API_KEY
            }
            
            log.info(f"Attempting to connect to LiteLLM at: {litellm_url}")
            response = requests.get(litellm_url, headers=headers, timeout=10)
            response.raise_for_status()
            log.info(f"Successfully connected to LiteLLM, received {len(response.json().get('data', []))} models")
            
            litellm_data = response.json()
            available_models = litellm_data.get('data', [])
            
            # Filter models based on user's access group
            filtered_models = []
            for model in available_models:
                model_info = model.get('model_info', {})
                litellm_params = model.get('litellm_params', {})
                access_groups = model_info.get('access_groups', [])

                # Skip models tagged with 'no-display' or 'do-not-display'
                # Tags can appear in either litellm_params (DB models) or model_info (config-based models)
                NO_DISPLAY_TAGS = {'no-display', 'do-not-display'}
                tags = set((litellm_params.get('tags') or []) + (model_info.get('tags') or []))
                if tags & NO_DISPLAY_TAGS:
                    continue
                
                if access_group in access_groups:
                    # Extract temperature range from model info
                    # LiteLLM doesn't provide explicit temperature ranges, so we'll use defaults
                    temperature_range = {
                        "min": 0.0,
                        "max": 2.0
                    }
                    
                    # Check if model has specific temperature constraints
                    if 'temperature' in model_info:
                        temp_config = model_info['temperature']
                        if isinstance(temp_config, dict):
                            temperature_range = {
                                "min": temp_config.get('min', 0.0),
                                "max": temp_config.get('max', 2.0)
                            }
                    
                    filtered_models.append({
                        "model": model.get('model_name'),
                        "friendly_name": model_info.get('litellm_provider', '') + '/' + model.get('model_name'),
                        "temperature_range": temperature_range,
                        "tags": list(tags),
                        "supports_image": model_info.get('supports_vision', False),
                        "supports_function_calling": model_info.get('supports_function_calling', False),
                        "supports_tool_choice": model_info.get('supports_tool_choice', False),
                        "supports_audio_input": model_info.get('supports_audio_input', False),
                        "supports_audio_output": model_info.get('supports_audio_output', False),
                        "supports_pdf_input": model_info.get('supports_pdf_input', False),
                        "supports_reasoning": model_info.get('supports_reasoning', False),
                        "max_tokens": model_info.get('max_tokens'),
                        "max_input_tokens": model_info.get('max_input_tokens'),
                        "max_output_tokens": model_info.get('max_output_tokens'),
                        "input_cost_per_token": model_info.get('input_cost_per_token'),
                        "output_cost_per_token": model_info.get('output_cost_per_token'),
                        "litellm_provider": model_info.get('litellm_provider'),
                        "access_groups": access_groups
                    })

            return Response({
                "data": {
                    "user_plan": user_plan,
                    "access_group": access_group,
                    "models": filtered_models
                }, 
                "status": status.HTTP_200_OK
            }, status=status.HTTP_200_OK)
            
        except requests.exceptions.RequestException as e:
            log.error(f"LiteLLM API request failed: {str(e)}")
            # Fallback to empty models list instead of error
            return Response({
                "data": {
                    "user_plan": self.get_user_plan(request.user.id),
                    "access_group": self.get_user_plan(request.user.id),
                    "models": []
                }, 
                "status": status.HTTP_200_OK,
                "warning": "LiteLLM service unavailable, returning empty model list"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            log.error(f"Error in LiteLLMModelConfigurations: {str(e)}")
            return handle_exception(e)
