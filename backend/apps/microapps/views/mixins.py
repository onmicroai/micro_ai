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
        """Deduct credits from the app owner's wallet after a run/TTS operation."""
        from apps.subscriptions.credits import spend_credits
        from apps.microapps.models import Run
        from apps.users.models import CustomUser

        if not self.credits:
            return True

        try:
            owner = CustomUser.objects.get(id=app_owner_id)
            consumer = (
                CustomUser.objects.filter(id=consumer_id).first() if consumer_id else None
            )
            run = Run.objects.filter(id=run_id).first()

            # Charge up to the run cost; drain the wallet even when the run costs
            # more than the remaining balance when the run cost exceeds the wallet.
            spend_credits(
                owner,
                self.credits,
                run=run,
                consumer=consumer,
                allow_partial=True,
            )
            return True

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
