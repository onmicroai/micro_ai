"""
AI model execution views - Run models and handle AI interactions.
"""
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
from django.http import StreamingHttpResponse
from asgiref.sync import sync_to_async

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import RunUsage, GuestUsage, get_user_ip
from apps.utils.global_variables import MicroappVariables, UsageVariables
from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.models import Microapp, MicroAppUserJoin, Run
from apps.microapps.serializer import (
    MicroAppSerializer,
    MicroappUserSerializer,
    RunPostSerializer,
    RunGetSerializer,
    RunPatchSerializer
)
from apps.users.models import CustomUser
from apps.users.serializers import UserSerializer
from apps.subscriptions.models import BillingCycle, TopUpToSubscription
from apps.subscriptions.serializers import UsageEventSerializer
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
    score_result = True
    app_hash_id = ""
    response_type = ""
    credits = 0

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

            run_data = {
                "ma_id": int(data.get("ma_id")),
                "user_id": data.get("user_id"),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": str(session_id),
                "satisfaction": 0,
                "prompt": api_params.get("messages", []),
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

    def skip_phase(self):
        """Handle skip phase response."""
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "You skipped this phase", "cost": 0, "credits": 0}

    def no_submission_phase(self):
        """Handle no submission phase response."""
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": "No submission", "cost": 0, "credits": 0}

    def fixed_response_phase(self, fixed_response):
        """Handle fixed response phase."""
        return {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0, "ai_response": fixed_response, "cost": 0, "credits": 0}

    def update_user_credits(self, run_id, app_owner_id, consumer_id):
        """Update user credits after run completion."""
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
            data = request.data
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
            
            # Handle guest users usage
            if not request.user.id:
                if not GuestUsage.check_usage_limit(self, ip):
                    return Response(error.RUN_USAGE_LIMIT_EXCEED, status=status.HTTP_400_BAD_REQUEST)
            # Handle logged-in users usage
            else:
                # Get owner details
                users = CustomUser.objects.get(id=app_owner_id)
                user_date_joined = UserSerializer(users).data["date_joined"]
                # Check if the owner has any credits available
                credits_check = RunUsage.check_for_available_credits(self, app_owner_id, user_date_joined)
                if not credits_check["has_credits"]:
                    return Response(
                        {"error": credits_check["message"]},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
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
                                "credits": combined_data["credits"]
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
            immutable_fields = ["ma_id", "user_id", "user_ip", "owner_id", "app_hash_id"]
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
            data = request.data
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

            # Handle guest users usage
            if not request.user.id:
                if not GuestUsage.check_usage_limit(self, ip):
                    return Response(error.RUN_USAGE_LIMIT_EXCEED, status=status.HTTP_400_BAD_REQUEST)
            # Handle logged-in users usage
            else:
                # Get owner details
                users = CustomUser.objects.get(id=app_owner_id)
                user_date_joined = UserSerializer(users).data["date_joined"]
                # Check if the owner has any credits available
                credits_check = RunUsage.check_for_available_credits(self, app_owner_id, user_date_joined)
                if not credits_check["has_credits"]:
                    return Response(
                        {"error": credits_check["message"]},
                        status=status.HTTP_400_BAD_REQUEST
                    )

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
                # Score first (non-streaming)
                score_messages = model.build_instruction(data, list(api_params["messages"]))
                score_params = api_params.copy()
                score_params["messages"] = score_messages
                score_params["stream"] = False
                score_response = model.score_response(score_params, data.get("minimum_score"))
                self.ai_score = score_response["ai_score"]
                self.score_result = score_response["score_result"]
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

                def should_explain() -> bool:
                    if not feedback_enabled:
                        return False
                    if not explanation_requested:
                        return False
                    if explanation_mode == "never":
                        return False
                    if explanation_mode == "failed_only":
                        return self.score_result is False
                    if explanation_mode == "passed_only":
                        return self.score_result is True
                    return True

                model_config = model_router["config"]
                if model_config.get("stream", True):
                    async def score_stream_generator():
                        score_payload = {
                            "run_score": self.ai_score,
                            "run_passed": self.score_result,
                            "minimum_score": data.get("minimum_score"),
                            "rubric": data.get("rubric"),
                            "scored_run": True,
                            "score_explanation": explanation_requested,
                            "score_explanation_mode": explanation_mode,
                            "score_feedback_enabled": feedback_enabled,
                            "score_feedback_instructions": feedback_instructions,
                        }
                        yield f"event: score\ndata: {json.dumps(score_payload)}\n\n"

                        if not should_explain():
                            response_data = {
                                "ai_response": "",
                                "prompt_tokens": score_response.get("prompt_tokens", 0),
                                "completion_tokens": score_response.get("completion_tokens", 0),
                                "total_tokens": score_response.get("total_tokens", 0),
                                "cost": score_response.get("cost", 0),
                                "credits": score_response.get("credits", 0),
                                "litellm_response_id": score_response.get("litellm_response_id"),
                            }
                            save_result = await sync_to_async(self.save_streaming_run_data)(
                                response_data,
                                data,
                                api_params,
                                model,
                                app_owner_id,
                                ip,
                                request.user.id if request.user.id else None
                            )
                            done_payload = {
                                "run_score": self.ai_score,
                                "run_passed": self.score_result,
                                "cost": response_data["cost"],
                                "credits": response_data["credits"],
                                "run_uuid": save_result.get("run_uuid") if save_result else data.get("run_uuid"),
                                "score_explanation": explanation_requested,
                                "score_explanation_mode": explanation_mode,
                                "score_feedback_enabled": feedback_enabled,
                                "score_feedback_instructions": feedback_instructions,
                            }
                            yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"
                            return

                        # Build explanation prompt (streaming)
                        explanation_messages = model.build_score_explanation_instruction(
                            data,
                            list(api_params["messages"]),
                            self.ai_score
                        )
                        explanation_params = api_params.copy()
                        explanation_params["messages"] = explanation_messages
                        explanation_params["stream"] = True

                        for chunk in model.stream_response(explanation_params):
                            yield f"data:{json.dumps(chunk)}\n\n"
                            await asyncio.sleep(0)

                        # Build response data for the explanation
                        if isinstance(model.last_usage, dict):
                            prompt_tokens = model.last_usage.get("prompt_tokens", 0)
                            completion_tokens = model.last_usage.get("completion_tokens", 0)
                            total_tokens = model.last_usage.get("total_tokens", 0)
                        else:
                            prompt_tokens = getattr(model.last_usage, "prompt_tokens", 0) if model.last_usage else 0
                            completion_tokens = getattr(model.last_usage, "completion_tokens", 0) if model.last_usage else 0
                            total_tokens = getattr(model.last_usage, "total_tokens", 0) if model.last_usage else 0

                        response_data = {
                            "ai_response": getattr(model, 'full_content', ''),
                            "prompt_tokens": prompt_tokens,
                            "completion_tokens": completion_tokens,
                            "total_tokens": total_tokens,
                            "cost": model.last_cost if hasattr(model, 'last_cost') else 0,
                            "credits": model.last_credits if hasattr(model, 'last_credits') else 0,
                            "litellm_response_id": getattr(model, 'litellm_response_id', None),
                        }

                        combined_data = response_data.copy()
                        combined_data.update({
                            "prompt_tokens": response_data["prompt_tokens"] + score_response["prompt_tokens"],
                            "completion_tokens": response_data["completion_tokens"] + score_response["completion_tokens"],
                            "total_tokens": response_data.get("total_tokens", 0) + score_response.get("total_tokens", 0),
                            "cost": round(response_data["cost"] + score_response["cost"], 6),
                            "credits": response_data["credits"] + score_response["credits"],
                        })

                        save_result = await sync_to_async(self.save_streaming_run_data)(
                            combined_data,
                            data,
                            api_params,
                            model,
                            app_owner_id,
                            ip,
                            request.user.id if request.user.id else None
                        )

                        done_payload = {
                            "run_score": self.ai_score,
                            "run_passed": self.score_result,
                            "cost": combined_data["cost"],
                            "credits": combined_data["credits"],
                            "run_uuid": save_result.get("run_uuid") if save_result else data.get("run_uuid"),
                            "score_explanation": explanation_requested,
                            "score_explanation_mode": explanation_mode,
                            "score_feedback_enabled": feedback_enabled,
                            "score_feedback_instructions": feedback_instructions,
                        }
                        yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

                    generator = score_stream_generator()
                    response = StreamingHttpResponse(generator, content_type="text/event-stream")
                    response['X-Accel-Buffering'] = 'no'
                    response['Cache-Control'] = 'no-cache'
                    return response
                else:
                    if not should_explain():
                        response = {
                            "ai_response": "",
                            "prompt_tokens": score_response.get("prompt_tokens", 0),
                            "completion_tokens": score_response.get("completion_tokens", 0),
                            "total_tokens": score_response.get("total_tokens", 0),
                            "cost": score_response.get("cost", 0),
                            "credits": score_response.get("credits", 0),
                            "litellm_response_id": score_response.get("litellm_response_id"),
                        }
                    else:
                        # Build explanation prompt (non-streaming)
                        explanation_messages = model.build_score_explanation_instruction(
                            data,
                            list(api_params["messages"]),
                            self.ai_score
                        )
                        explanation_params = api_params.copy()
                        explanation_params["messages"] = explanation_messages
                        explanation_params["stream"] = False
                        explanation_response = model.get_response(explanation_params)
                        if not explanation_response["status"]:
                            return Response({"error": error.INVALID_PAYLOAD, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
                        explanation_response = explanation_response["data"]
                        explanation_response.update({
                            "prompt_tokens": explanation_response["prompt_tokens"] + score_response["prompt_tokens"],
                            "completion_tokens": explanation_response["completion_tokens"] + score_response["completion_tokens"],
                            "total_tokens": explanation_response.get("total_tokens", 0) + score_response.get("total_tokens", 0),
                            "cost": round(explanation_response["cost"] + score_response["cost"], 6),
                            "credits": explanation_response["credits"] + score_response["credits"],
                        })
                        response = explanation_response
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
            data = request.data
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
            
            # Handle guest users usage
            if not request.user.id:
                if not GuestUsage.check_usage_limit(self, ip):
                    return Response(error.RUN_USAGE_LIMIT_EXCEED, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Get owner details
                users = CustomUser.objects.get(id=app_owner_id)
                user_date_joined = UserSerializer(users).data["date_joined"]
                # Check if the owner has any credits available
                credits_check = RunUsage.check_for_available_credits(self, app_owner_id, user_date_joined)
                if not credits_check["has_credits"]:
                    return Response(
                        {"error": credits_check["message"]},
                        status=status.HTTP_400_BAD_REQUEST
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
        """Get the user's current subscription plan"""
        try:
            # Get the user's current billing cycle
            billing_cycle = BillingCycle.objects.filter(
                user=user_id,
                status='open',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).first()
            
            if billing_cycle and billing_cycle.subscription:
                # Check the subscription's price_id against known price IDs
                price_id = billing_cycle.subscription.price_id
                if price_id == settings.PRO_PLAN_PRICE_ID:
                    return "pro"
                elif price_id == settings.ENTERPRISE_PLAN_PRICE_ID:
                    return "enterprise"
            
            # Default to free plan if no active subscription or unknown price_id
            return "free"
            
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

            print(response.json())
            
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
