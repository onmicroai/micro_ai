"""
Shared mixins and utilities for microapp views.
"""
import logging as log
from rest_framework import status
from rest_framework.response import Response
from apps.utils.custom_error_message import ErrorMessages as error


def handle_exception(e):
    """Centralized exception handling for all views."""
    log.error(e)
    return Response(
        error.SERVER_ERROR,
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class MicroAppMixin:
    """Common functionality for microapp-related views."""
    
    def get_microapp(self, app_id):
        """Get microapp by ID with error handling."""
        try:
            from apps.microapps.models import Microapp
            return Microapp.objects.get(id=app_id)
        except Microapp.DoesNotExist:
            return None
    
    def get_microapp_by_hash(self, hash_id):
        """Get microapp by hash ID with error handling."""
        try:
            from apps.microapps.models import Microapp
            return Microapp.objects.get(hash_id=hash_id)
        except Microapp.DoesNotExist:
            return None


class UserPermissionMixin:
    """Common permission and user-related functionality."""
    
    def get_user_role(self, user_id, app_id):
        """Get user's role for a specific microapp."""
        try:
            from apps.microapps.models import MicroAppUserJoin
            return MicroAppUserJoin.objects.get(user_id=user_id, ma_id=app_id)
        except MicroAppUserJoin.DoesNotExist:
            return None


class UsageTrackingMixin:
    """Common usage tracking functionality."""
    
    def check_user_credits(self, user_id, app_owner_id):
        """Check if user has available credits."""
        from apps.utils.usage_helper import RunUsage
        from apps.users.models import CustomUser
        from apps.users.serializers import UserSerializer
        
        try:
            users = CustomUser.objects.get(id=app_owner_id)
            user_date_joined = UserSerializer(users).data["date_joined"]
            return RunUsage.check_for_available_credits(self, app_owner_id, user_date_joined)
        except Exception as e:
            log.error(f"Error checking user credits: {e}")
            return {"has_credits": False, "message": "Error checking credits"}

    def update_user_credits(self, run_id, app_owner_id, consumer_id):
        """Deduct credits from the app owner's billing cycle after a run/TTS operation."""
        import datetime
        from django.db.models import F
        from django.utils import timezone
        from apps.subscriptions.models import BillingCycle, TopUpToSubscription
        from apps.subscriptions.serializers import UsageEventSerializer

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

            top_up = None
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


class FileProcessingMixin:
    """Common file processing functionality."""
    
    def sanitize_filename(self, filename):
        """Sanitize filename to remove problematic characters."""
        import re
        return re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    
    def count_words(self, text):
        """Count words efficiently without loading full text into memory."""
        count = 0
        for word in text.split():
            count += 1
        return count
