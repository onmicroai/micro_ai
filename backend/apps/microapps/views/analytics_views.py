"""
Analytics and statistics views - Reporting and billing information.
"""
import logging as log
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.db.models import Min, Case, When, Count, F, Sum, Value, FloatField, Q, ExpressionWrapper, IntegerField
from django.db.models.functions import Round

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import MicroAppUsage
from apps.microapps.models import Run
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
    get=extend_schema(responses={200: dict}, summary="Get user apps run statistics")
)
class AppStatistics(APIView):
    """Get statistics for user's microapps."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get run statistics for user's apps."""
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
    """Get conversation analytics for user's apps."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get conversation data for user's apps."""
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
    """Get detailed conversation information."""
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
