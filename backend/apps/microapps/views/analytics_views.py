"""
Analytics and statistics views - Reporting and billing information.
"""
import logging as log
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.db.models import Min, Case, When, Count, F, Sum, Value, FloatField, Q, ExpressionWrapper, IntegerField, OuterRef, Subquery
from django.db.models.functions import Round

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import MicroAppUsage
from apps.microapps.models import Microapp, MicroAppUserJoin, Run
from apps.subscriptions.models import BillingCycle, TopUpToSubscription
from apps.subscriptions.serializers import BillingDetailsSerializer
from .mixins import handle_exception


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

            runs = Run.objects.filter(ma_id=app_id).values('ma_id').annotate(
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
            )

            return Response({"data": runs, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)

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
