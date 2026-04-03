"""
Analytics and statistics views - Reporting and billing information.
"""
import logging as log
import uuid
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.db.models import Min, Max, Avg, Case, When, Count, F, Sum, Value, FloatField, Q, ExpressionWrapper, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce, Round

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import MicroAppUsage
from apps.utils.usage_helper import get_user_ip
from apps.microapps.models import Microapp, MicroAppUserJoin, Run, AppUsageSession, AppThemeSnapshot
from apps.subscriptions.models import BillingCycle, TopUpToSubscription
from apps.subscriptions.serializers import BillingDetailsSerializer
from .mixins import handle_exception
from django.utils import timezone

MIN_USAGE_DURATION_SECONDS = 5


def get_latest_themes_for_app(app_id):
    snapshot = (
        AppThemeSnapshot.objects.filter(ma_id=app_id, status="success")
        .order_by("-generated_at")
        .first()
    )
    if not snapshot:
        return [], None
    return snapshot.themes_json or [], snapshot.generated_at


def get_stats_for_app_ids(app_ids):
    """
    Return stats (sessions, unique_users, total_credits, avg_credits_session) for given app IDs.
    Returns dict mapping app_id -> stats. Apps with no runs get zeroed stats.
    """
    if not app_ids:
        return {}
    app_ids = list(app_ids)
    stats_qs = Run.objects.filter(ma_id__in=app_ids).values('ma_id').annotate(
        total_credits=Coalesce(Sum('credits'), 0),
        unique_users=Count('user_ip', distinct=True),
        sessions=Count('session_id', distinct=True),
    ).values('ma_id', 'total_credits', 'unique_users', 'sessions')

    result = {aid: {'sessions': 0, 'unique_users': 0, 'total_credits': 0, 'avg_credits_session': 0, 'avg_session_seconds': 0, 'min_session_seconds': 0, 'max_session_seconds': 0} for aid in app_ids}
    for row in stats_qs:
        ma_id = row['ma_id']
        sessions = row['sessions'] or 0
        total_credits = int(row['total_credits'] or 0)
        avg_credits_session = round(total_credits / sessions, 2) if sessions else 0
        result[ma_id] = {
            'sessions': sessions,
            'unique_users': row['unique_users'] or 0,
            'total_credits': total_credits,
            'avg_credits_session': avg_credits_session,
            'avg_session_seconds': 0,
            'min_session_seconds': 0,
            'max_session_seconds': 0,
        }
    usage_rows = AppUsageSession.objects.filter(ma_id__in=app_ids).values('ma_id', 'started_at', 'ended_at', 'last_seen_at')
    durations = {}
    for usage in usage_rows:
        end_time = usage['ended_at'] or usage['last_seen_at'] or usage['started_at']
        duration_seconds = max((end_time - usage['started_at']).total_seconds(), 0)
        if duration_seconds < MIN_USAGE_DURATION_SECONDS:
            continue
        durations.setdefault(usage['ma_id'], []).append(duration_seconds)
    for ma_id, values in durations.items():
        if ma_id in result and values:
            result[ma_id]['avg_session_seconds'] = round(sum(values) / len(values), 2)
            result[ma_id]['min_session_seconds'] = round(min(values), 2)
            result[ma_id]['max_session_seconds'] = round(max(values), 2)
    return result


@extend_schema_view(
    get=extend_schema(
        responses={200: BillingDetailsSerializer},
        summary="user-billing-details"
    )
)
class BillingDetails(APIView):
    """Get user billing details and credit information."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, format=None):
        """Get billing details for authenticated user."""
        try:
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
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    get=extend_schema(responses={200: dict}, summary="Get run statistics for a specific app")
)
class AppStatistics(APIView):
    """Get statistics for a specific microapp. Requires owner or admin role."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get run statistics for a specific app."""
        try:
            user_id = request.user.id
            app_id = request.GET.get('app_id')
            hash_id = request.GET.get('hash_id')

            if not app_id and not hash_id:
                return Response(
                    {"error": "app_id or hash_id is required", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Resolve hash_id to the stable numeric app_id
            if not app_id:
                try:
                    app_id = Microapp.objects.values_list('id', flat=True).get(hash_id=hash_id)
                except Microapp.DoesNotExist:
                    return Response(
                        {"error": "App not found", "status": status.HTTP_404_NOT_FOUND},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # Verify the requesting user is an owner or admin of the app
            if not MicroAppUserJoin.objects.filter(
                user_id=user_id,
                ma_id=app_id,
                role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN]
            ).exists():
                return Response(
                    {"error": "You don't have permission to view stats for this app", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN
                )

            runs = list(Run.objects.filter(ma_id=app_id).values('ma_id').annotate(
                total_responses=Count(
                    Case(
                        When(satisfaction__in=[1, -1], then=1)
                    )
                ),
                net_satisfaction_score=Case(
                    When(
                        Q(total_responses=0),
                        then=Value(0, output_field=FloatField())
                    ),
                    default=Round(
                        Sum(
                            Case(
                                When(satisfaction__in=[1], then=F('satisfaction')),
                                default=Value(0)
                            )
                        ) * 1.0 / F('total_responses'),
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
                total_cost=Sum('cost'),
                total_credits=Sum('credits'),
                unique_users=Count('user_ip', distinct=True),
                sessions=Count('session_id', distinct=True),
                avg_cost_session=F('total_cost') / F('sessions'),
                avg_credits_session=F('total_credits') / F('sessions'),
            ).values(
                'ma_id', 'net_satisfaction_score', 'thumbs_up_count', 'thumbs_down_count',
                'total_responses', 'total_cost', 'total_credits', 'unique_users', 'sessions',
                'avg_cost_session', 'avg_credits_session'
            ))

            usage_rows = AppUsageSession.objects.filter(ma_id=app_id).values('started_at', 'ended_at', 'last_seen_at')
            durations = []
            for usage in usage_rows:
                end_time = usage['ended_at'] or usage['last_seen_at'] or usage['started_at']
                duration_seconds = max((end_time - usage['started_at']).total_seconds(), 0)
                if duration_seconds < MIN_USAGE_DURATION_SECONDS:
                    continue
                durations.append(duration_seconds)
            avg_session_seconds = round(sum(durations) / len(durations), 2) if durations else 0
            min_session_seconds = round(min(durations), 2) if durations else 0
            max_session_seconds = round(max(durations), 2) if durations else 0

            if runs:
                runs[0]['avg_session_seconds'] = avg_session_seconds
                runs[0]['min_session_seconds'] = min_session_seconds
                runs[0]['max_session_seconds'] = max_session_seconds
                themes, generated_at = get_latest_themes_for_app(app_id)
                runs[0]['themes'] = themes
                runs[0]['themes_generated_at'] = generated_at

                # Tokens per run (input + output), across all runs for this app
                token_qs = Run.objects.filter(ma_id=app_id).annotate(
                    total_tokens=ExpressionWrapper(
                        F('input_tokens') + F('output_tokens'),
                        output_field=IntegerField(),
                    )
                )
                token_agg = token_qs.aggregate(
                    avg_tokens=Avg('total_tokens'),
                    min_tokens=Min('total_tokens'),
                    max_tokens=Max('total_tokens'),
                )
                avg_t = token_agg.get('avg_tokens')
                runs[0]['avg_tokens_per_run'] = int(round(avg_t)) if avg_t is not None else 0
                runs[0]['min_tokens_per_run'] = int(token_agg['min_tokens'] or 0)
                runs[0]['max_tokens_per_run'] = int(token_agg['max_tokens'] or 0)

                # Pass / fail among scored runs only
                scored_qs = Run.objects.filter(ma_id=app_id, scored_run=True)
                passed_ct = scored_qs.filter(run_passed=True).count()
                failed_ct = scored_qs.filter(run_passed=False).count()
                scored_total = passed_ct + failed_ct
                if scored_total:
                    runs[0]['pass_rate_percent'] = round(100.0 * passed_ct / scored_total, 1)
                    runs[0]['pass_percent'] = round(100.0 * passed_ct / scored_total, 1)
                    runs[0]['fail_percent'] = round(100.0 * failed_ct / scored_total, 1)
                else:
                    runs[0]['pass_rate_percent'] = 0
                    runs[0]['pass_percent'] = 0
                    runs[0]['fail_percent'] = 0

                # Satisfaction: thumbs among users who left a rating
                up = runs[0].get('thumbs_up_count') or 0
                down = runs[0].get('thumbs_down_count') or 0
                rated = up + down
                if rated:
                    runs[0]['satisfaction_percent'] = round(100.0 * up / rated, 1)
                    runs[0]['likes_percent'] = round(100.0 * up / rated, 1)
                    runs[0]['dislikes_percent'] = round(100.0 * down / rated, 1)
                else:
                    runs[0]['satisfaction_percent'] = 0
                    runs[0]['likes_percent'] = 0
                    runs[0]['dislikes_percent'] = 0

            return Response({"data": runs, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)

        except Exception as e:
            return handle_exception(e)


class AppThemes(APIView):
    """Get latest generated themes for a specific app."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user_id = request.user.id
            app_id = request.GET.get("app_id")
            hash_id = request.GET.get("hash_id")

            if not app_id and not hash_id:
                return Response(
                    {"error": "app_id or hash_id is required", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not app_id:
                try:
                    app_id = Microapp.objects.values_list("id", flat=True).get(hash_id=hash_id)
                except Microapp.DoesNotExist:
                    return Response(
                        {"error": "App not found", "status": status.HTTP_404_NOT_FOUND},
                        status=status.HTTP_404_NOT_FOUND,
                    )

            if not MicroAppUserJoin.objects.filter(
                user_id=user_id,
                ma_id=app_id,
                role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN],
            ).exists():
                return Response(
                    {"error": "You don't have permission to view themes for this app", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN,
                )

            themes, generated_at = get_latest_themes_for_app(app_id)
            return Response(
                {
                    "data": {
                        "themes": themes,
                        "generated_at": generated_at,
                    },
                    "status": status.HTTP_200_OK,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return handle_exception(e)


class AppConversations(APIView):
    """Get conversation analytics for a specific microapp. Requires owner or admin role."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get conversation data for a specific app."""
        try:
            user_id = request.user.id
            app_id = request.GET.get('app_id')
            hash_id = request.GET.get('hash_id')

            if not app_id and not hash_id:
                return Response(
                    {"error": "app_id or hash_id is required", "status": status.HTTP_400_BAD_REQUEST},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Resolve hash_id to the stable numeric app_id
            if not app_id:
                try:
                    app_id = Microapp.objects.values_list('id', flat=True).get(hash_id=hash_id)
                except Microapp.DoesNotExist:
                    return Response(
                        {"error": "App not found", "status": status.HTTP_404_NOT_FOUND},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # Verify the requesting user is an owner or admin of the app
            if not MicroAppUserJoin.objects.filter(
                user_id=user_id,
                ma_id=app_id,
                role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN]
            ).exists():
                return Response(
                    {"error": "You don't have permission to view stats for this app", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Correlated subqueries compute satisfaction and model mode per session
            # without N+1 queries — the DB resolves both in a single round trip.
            satisfaction_subquery = Subquery(
                Run.objects.filter(
                    ma_id=app_id,
                    session_id=OuterRef('session_id'),
                    satisfaction__isnull=False,
                    satisfaction__in=[1, -1]
                ).values('satisfaction')
                .annotate(count=Count('satisfaction'))
                .order_by('-count', 'satisfaction')
                .values('satisfaction')[:1]
            )

            model_subquery = Subquery(
                Run.objects.filter(
                    ma_id=app_id,
                    session_id=OuterRef('session_id')
                ).values('ai_model')
                .annotate(count=Count('ai_model'))
                .order_by('-count', 'ai_model')
                .values('ai_model')[:1]
            )

            conversations = Run.objects.filter(ma_id=app_id).values('session_id').annotate(
                start_time=Min('timestamp'),
                total_cost=Sum('cost'),
                messages_count=Count('id'),
                total_credits=Sum('credits'),
                satisfaction=satisfaction_subquery,
                model=model_subquery,
                passes=Count(Case(When(scored_run=True, run_passed=True, then=1))),
                fails=Count(Case(When(scored_run=True, run_passed=False, then=1))),
            ).order_by('-start_time')

            # Optional pagination via ?page=1&page_size=50
            page_size = request.GET.get('page_size')
            if page_size:
                page_size = int(page_size)
                page = int(request.GET.get('page', 1))
                total_count = conversations.count()
                offset = (page - 1) * page_size
                conversations = conversations[offset:offset + page_size]
                return Response(
                    {
                        "data": list(conversations),
                        "total_count": total_count,
                        "page": page,
                        "page_size": page_size,
                        "status": status.HTTP_200_OK,
                    },
                    status=status.HTTP_200_OK
                )

            return Response(
                {"data": list(conversations), "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return handle_exception(e)


class AppConversationDetails(APIView):
    """Get detailed conversation information. Requires owner or admin role on the app."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get detailed conversation data for a specific session."""
        try:
            session_id = request.GET.get('session_id')
            if not session_id:
                return Response(
                    error.FIELD_MISSING,
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Resolve session_id to a stable numeric app_id
            app_id = Run.objects.filter(
                session_id=session_id
            ).values_list('ma_id', flat=True).first()

            if app_id is None:
                return Response(
                    {"error": "Conversation not found", "status": status.HTTP_404_NOT_FOUND},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Verify the requesting user is an owner or admin of the app
            if not MicroAppUserJoin.objects.filter(
                user_id=request.user.id,
                ma_id=app_id,
                role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN]
            ).exists():
                return Response(
                    {"error": "You don't have permission to view this conversation", "status": status.HTTP_403_FORBIDDEN},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Include ma_id in the filter so the composite (ma_id, session_id) index is used
            conversation = Run.objects.filter(
                ma_id=app_id,
                session_id=session_id
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

            return Response(
                {"data": list(conversation), "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return handle_exception(e)


class AppUsageSessionStart(APIView):
    """Start or refresh an app usage session."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            hash_id = request.data.get('hash_id')
            source = request.data.get('source') or "app"
            if source not in {"app", "preview", "embed"}:
                source = "app"
            if not hash_id:
                return Response({"error": "hash_id is required", "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
            app = Microapp.objects.filter(hash_id=hash_id).first()
            if not app:
                return Response({"error": "App not found", "status": status.HTTP_404_NOT_FOUND}, status=status.HTTP_404_NOT_FOUND)

            user = request.user if request.user.is_authenticated else None
            ip = get_user_ip(request)
            session_id = str(uuid.uuid4())
            AppUsageSession.objects.create(
                ma_id=app,
                user_id=user,
                session_id=session_id,
                source=source,
                user_ip=ip,
            )
            return Response({"session_id": session_id, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        except Exception as e:
            return handle_exception(e)


class AppUsageSessionHeartbeat(APIView):
    """Keep an app usage session alive while user remains in app."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            hash_id = request.data.get('hash_id')
            session_id = request.data.get('session_id')
            if not hash_id or not session_id:
                return Response({"error": "hash_id and session_id are required", "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
            app = Microapp.objects.filter(hash_id=hash_id).first()
            if not app:
                return Response({"error": "App not found", "status": status.HTTP_404_NOT_FOUND}, status=status.HTTP_404_NOT_FOUND)

            usage = AppUsageSession.objects.filter(ma_id=app.id, session_id=session_id, ended_at__isnull=True).order_by('-started_at').first()
            if usage:
                usage.last_seen_at = timezone.now()
                usage.save(update_fields=['last_seen_at'])
            return Response({"status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        except Exception as e:
            return handle_exception(e)


class AppUsageSessionEnd(APIView):
    """End an app usage session."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            hash_id = request.data.get('hash_id')
            session_id = request.data.get('session_id')
            if not hash_id or not session_id:
                return Response({"error": "hash_id and session_id are required", "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
            app = Microapp.objects.filter(hash_id=hash_id).first()
            if not app:
                return Response({"error": "App not found", "status": status.HTTP_404_NOT_FOUND}, status=status.HTTP_404_NOT_FOUND)

            usage = AppUsageSession.objects.filter(ma_id=app.id, session_id=session_id, ended_at__isnull=True).order_by('-started_at').first()
            if usage:
                now = timezone.now()
                usage.last_seen_at = now
                usage.ended_at = now
                usage.save(update_fields=['last_seen_at', 'ended_at'])
            return Response({"status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
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
    """Get user's app creation quota information."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user's app quota information."""
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
