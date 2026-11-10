"""
Views for evaluating chat completion criteria after a successful chat turn.
"""
import logging as log

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.microapps.completion_criteria_service import (
    build_conversation_transcript,
    evaluate_completion_criteria,
    normalize_criteria,
)
from apps.microapps.models import MicroAppUserJoin, Run
from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import GuestUsage, get_user_ip

from .mixins import UsageTrackingMixin, handle_exception


@extend_schema_view(
    post=extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "app_id": {"type": "integer"},
                    "run_uuid": {"type": "string"},
                    "criteria": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "text": {"type": "string"},
                            },
                        },
                    },
                },
                "required": ["app_id", "run_uuid", "criteria"],
            }
        },
        responses={200: None},
        summary="Evaluate chat completion criteria for a finished chat turn",
    )
)
class CompletionCriteriaCheck(APIView, UsageTrackingMixin):
    """Recheck yes/no completion criteria against a chat run's stored transcript."""

    permission_classes = [IsAuthenticated]

    def _charge_check(self, run, cost, credits, consumer_id):
        """
        Add this check's cost/credits onto the chat run and deduct from the owner.
        Returns cumulative (cost, credits) for the run.
        """
        if cost <= 0 and credits <= 0:
            return float(run.cost or 0), int(run.credits or 0)

        try:
            new_cost = round(float(run.cost or 0) + cost, 6)
            new_credits = int(run.credits or 0) + int(credits)
            Run.objects.filter(pk=run.pk).update(
                cost=new_cost,
                credits=new_credits,
            )

            owner_join = MicroAppUserJoin.objects.get(ma_id=run.ma_id, role="owner")
            self.credits = credits
            self.update_user_credits(run.id, owner_join.user_id.id, consumer_id)
            return new_cost, new_credits
        except Exception as e:
            log.error(
                "Completion criteria credit deduction failed for run %s: %s",
                run.run_uuid,
                e,
            )
            return float(run.cost or 0), int(run.credits or 0)

    def post(self, request, format=None):
        try:
            app_id = request.data.get("app_id")
            run_uuid = request.data.get("run_uuid")
            criteria = normalize_criteria(request.data.get("criteria"))

            if not app_id or not run_uuid:
                return Response(
                    {"error": "app_id and run_uuid are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not criteria:
                return Response(
                    {"error": "At least one completion criterion is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                run = Run.objects.get(run_uuid=run_uuid)
            except Run.DoesNotExist:
                return Response(
                    {"error": "Run not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not run.ma_id_id or int(run.ma_id_id) != int(app_id):
                return Response(
                    {"error": "Run does not belong to this app"},
                    status=status.HTTP_403_FORBIDDEN,
                )

            transcript = build_conversation_transcript(
                run.api_messages,
                run.response,
            )
            if not transcript:
                return Response(
                    {"error": "Conversation transcript is empty"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                results, cost, credits = evaluate_completion_criteria(
                    transcript,
                    criteria,
                )
            except Exception as e:
                log.error("Completion criteria evaluation error: %s", e)
                return Response(
                    {"error": "Failed to evaluate completion criteria"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            consumer_id = getattr(request.user, "id", None)
            total_cost, total_credits = self._charge_check(
                run,
                cost,
                credits,
                consumer_id,
            )

            return Response(
                {
                    "results": results,
                    "cost": total_cost,
                    "credits": total_credits,
                }
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    post=extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "app_id": {"type": "integer"},
                    "run_uuid": {"type": "string"},
                    "criteria": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "text": {"type": "string"},
                            },
                        },
                    },
                },
                "required": ["app_id", "run_uuid", "criteria"],
            }
        },
        responses={200: None},
        summary="Evaluate chat completion criteria (anonymous)",
    )
)
class AnonymousCompletionCriteriaCheck(CompletionCriteriaCheck):
    """Anonymous twin with guest usage limiting."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, format=None):
        try:
            ip = get_user_ip(request)
            if not GuestUsage.check_usage_limit(self, ip):
                return Response(
                    error.RUN_USAGE_LIMIT_EXCEED,
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return super().post(request, format)
        except Exception as e:
            return handle_exception(e)
