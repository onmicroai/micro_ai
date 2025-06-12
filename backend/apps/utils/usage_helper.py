import logging
from datetime import datetime
from django.db.models import Count
from django.utils import timezone
from apps.microapps.models import Run, MicroAppUserJoin
from apps.subscriptions.models import Subscription, BillingCycle, TopUpToSubscription
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
    def check_for_available_credits(self, user_id, date_joined):
        from apps.subscriptions.helpers import update_or_create_free_subscription, create_free_billing_cycle
        user = CustomUser.objects.get(id=user_id)
        subscription_data = subscription_details(user_id)
        
        if (not subscription_data or 
            subscription_data["status"] == "canceled" or 
            (subscription_data["period_end"] and 
             convert_timestamp_to_datetime(subscription_data["period_end"]) < timezone.now())):
            # If the user has no subscription, has canceled, or their subscription has expired,
            # create a free one
            subscription_instance = update_or_create_free_subscription(user)
            # Get the serialized version of the new subscription
            subscription_data = subscription_details(user_id)
            
        if subscription_data["status"] in ["incomplete", "incomplete_expired", "past_due", "unpaid"]:
            return {
                "status": "invalid_subscription",
                "message": f"Subscription is {subscription_data['status']}",
                "has_credits": False
            }
            
        if subscription_data["status"] == "active":
            subscription_instance = Subscription.objects.get(id=subscription_data["id"])
            # Only look for open billing cycles that are currently active
            billing_cycle = BillingCycle.objects.filter(
                subscription=subscription_instance,
                status='open',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).first()
            
            if not billing_cycle:
                # If no active billing cycle exists, create a new one
                create_free_billing_cycle(user, subscription_instance)
                # Fetch the newly created billing cycle to ensure we have fresh data
                billing_cycle = BillingCycle.objects.filter(
                    subscription=subscription_instance, 
                    status='open'
                ).first()
                
            if not billing_cycle:
                # If we still don't have a billing cycle, something went wrong
                return {
                    "status": "error",
                    "message": "Failed to create or retrieve billing cycle",
                    "has_credits": False
                }
                
            main_available = billing_cycle.credits_remaining
            top_ups = TopUpToSubscription.objects.filter(user=user_id)
            total_topup_available = sum([top_up.remaining_credits for top_up in top_ups])
            combined_available = main_available + total_topup_available
            if combined_available <= 0:
                return {
                    "status": "no_credits",
                    "message": "No credits remaining in active subscription",
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

        # If user has an active subscription
        if subscription and subscription["status"] == "active":
            # Get max_apps from subscription configuration
            max_apps = UsageVariables.FREE_PLAN_MICROAPP_LIMIT
            
            # Get price_id from subscription
            from apps.subscriptions.constants import PRICE_IDS
            
            price_id = subscription["price_id"]
            
            # Check if plan is enterprise or individual by comparing price_id
            is_paid_plan = (price_id == PRICE_IDS["individual"] or 
                           price_id == PRICE_IDS["enterprise"])
            
            # For enterprise or individual plans, can_create is always true
            # For free plan, can_create depends on the current app count vs limit
            return {
                "can_create": is_paid_plan or current_app_count < max_apps,
                "limit": max_apps,
                "current_count": current_app_count
            }
                
        # No active subscription - treat as free plan with default limit
        return {
            "can_create": current_app_count < UsageVariables.FREE_PLAN_MICROAPP_LIMIT,
            "limit": UsageVariables.FREE_PLAN_MICROAPP_LIMIT,
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
