import logging
from datetime import datetime
from django.db.models import Count
from django.utils import timezone
from apps.microapps.models import Run, MicroAppUserJoin
from apps.subscriptions.models import Subscription
from apps.subscriptions.helpers import resolve_max_apps_for_user
from apps.subscriptions.serializers import CustomSubscriptionSerializer
from apps.users.models import CustomUser
from apps.utils.global_variables import UsageVariables

log = logging.getLogger("micro_ai.subscription")

def convert_timestamp_to_datetime(timestamp):
    dt = datetime.fromtimestamp(int(timestamp))
    return timezone.make_aware(dt)

def subscription_details(user_id):
    subscription = Subscription.objects.filter(user_id=user_id).order_by('-created_at').first()
    if subscription:
        serializer = CustomSubscriptionSerializer(subscription)
        serializerData = serializer.data
        return serializerData
    return None

def get_user_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip

class RunUsage:
    
    def format_date(self, start_date, end_date):
        start = datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')
        return {"start":start, "end":end}
    
    @staticmethod
    def check_for_available_credits(self, user_id, date_joined=None, *, audience="owner"):
        """
        Check whether the app owner can fund another run.

        audience:
          - "owner": message for the account holder (preview, editor, logged-in owner)
          - "public": message for anonymous/guest visitors when the owner is out of credits
        """
        from apps.subscriptions.helpers import subscription_billing_blocked
        from apps.subscriptions.credits import available_credits

        user = CustomUser.objects.get(id=user_id)
        subscription = Subscription.objects.filter(user_id=user_id).order_by("-created_at").first()

        if subscription_billing_blocked(subscription):
            return {
                "status": "invalid_subscription",
                "message": (
                    "This subscription can't run apps right now. "
                    "Check Settings → Subscription to fix billing."
                    if audience == "owner"
                    else "This app isn't available right now. Please try again later."
                ),
                "has_credits": False
            }

        # Wallet is the source of truth; created and lazily reset on access (Free or paid).
        combined_available = available_credits(user)
        if combined_available <= 0:
            if audience == "public":
                message = (
                    "This app isn't available right now because the creator "
                    "has no credits remaining. Please try again later."
                )
                status_key = "owner_no_credits_public"
            else:
                message = (
                    "You've used all your credits for this billing period. "
                    "Open Settings → Subscription to add credits or upgrade your plan."
                )
                status_key = "no_credits"
            return {
                "status": status_key,
                "message": message,
                "has_credits": False
            }

        return {
            "status": "active",
            "message": "Credits available",
            "has_credits": True,
            "credits_remaining": combined_available
        }
    
class MicroAppUsage:
    @staticmethod
    def check_max_apps(user_id):
        # Get user's subscription details if they exist
        subscription = subscription_details(user_id)
        
        # Count how many active microapps the user owns
        # Filters for:
        # - apps owned by this user
        # - where they are the owner (not just a collaborator)
        # - apps that count towards their usage limit
        # - non-archived apps
        userapps = MicroAppUserJoin.objects.filter(
            user_id=user_id, 
            role="owner", 
            counts_toward_max=True, 
            is_archived=False).aggregate(count=Count("id"))
        
        current_app_count = userapps["count"] or 0

        max_apps = resolve_max_apps_for_user(user_id)

        return {
            "can_create": current_app_count < max_apps,
            "limit": max_apps,
            "current_count": current_app_count
        }

class GuestUsage:
    
    def get_user_sessions(self, ip):
        date = datetime.now().strftime("%Y-%m-%d")
        filters = {
                "timestamp__date__gte": date,
                "user_ip": ip,
                "user_id": None
            }
        sessions = Run.objects.filter(**filters).count()
        sessions = Run.objects.filter(**filters).distinct("session_id").count()
        return sessions

    @staticmethod
    def check_usage_limit(self, ip):
        sessions = GuestUsage.get_user_sessions(self, ip)
        return sessions < UsageVariables.GUEST_USER_SESSION_LIMIT
