from apps.microapps.models import Run
from apps.subscriptions.models import Subscription, BillingCycle
from apps.subscriptions.serializers import CustomSubscriptionSerializer, PlansSerializer
from datetime import datetime
from django.db.models import Sum
from dateutil.relativedelta import relativedelta
from apps.utils.global_variables import UsageVariables
from apps.microapps.models import MicroAppUserJoin
from django.db.models import Count
from apps.subscriptions.helpers import get_subscription_max_apps
from django.utils import timezone

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

def check_plan(amount):
        if amount == UsageVariables.FREE_PLAN_AMOUNT_MONTH or amount == UsageVariables.FREE_PLAN_AMOUNT_YEAR:
            return{"limit": UsageVariables.FREE_PLAN_CREDIT_LIMIT, "plan": UsageVariables.FREE_PLAN}
        elif amount == UsageVariables.ENTERPRISE_PLAN_AMOUNT_MONTH or amount == UsageVariables.ENTERPRISE_PLAN_AMOUNT_YEAR:
            return{"limit": UsageVariables.ENTERPRISE_PLAN_CREDIT_LIMIT, "plan": UsageVariables.ENTERPRISE_PLAN}
        else:
            return{"limit": UsageVariables.INDIVIDUAL_PLAN_CREDIT_LIMIT, "plan": UsageVariables.INDIVIDUAL_PLAN} 

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
    
    def credits_calculation(self, user_id, start_date, end_date):
        filters = {
                "owner_id": user_id,
                "timestamp__date__gte": start_date,
                "timestamp__date__lte": end_date
            }
        filters = {k: v for k, v in filters.items() if v is not None}
        queryset = Run.objects.filter(**filters).aggregate(total_credits = Sum('credits'))
        return queryset["total_credits"] if queryset["total_credits"] else UsageVariables.DEFAULT_TOTAL_COST

    @staticmethod
    def get_run_related_info(self, user_id, date_joined):
        subscription = subscription_details(user_id)
        print("SUBSCRIPTION", subscription)
        # Enterprise and individual plan implementation
        if subscription and subscription["status"] == "active":
            # Get active billing cycle for this subscription
            active_cycle = BillingCycle.objects.filter(
                subscription_id=subscription["id"],
                status='open',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).first()
            # Check if billing cycle exists and has credits remaining
            return active_cycle and active_cycle.credits_remaining > 0
        
        # Default free plan implementation
        try:
            # First try parsing with microseconds
            day_joined = datetime.strptime(date_joined, "%Y-%m-%dT%H:%M:%S.%fZ").date().strftime("%d")
        except ValueError:
            # If that fails, try without microseconds
            day_joined = datetime.strptime(date_joined, "%Y-%m-%dT%H:%M:%SZ").date().strftime("%d")
        current_month = datetime.now().strftime("%m")
        current_year = datetime.now().strftime("%Y")
        if datetime.now().strftime("%d") > day_joined:
            start_date = f"{current_year}-{current_month}-{day_joined}"
            end_date = (datetime.strptime(start_date, "%Y-%m-%d").date() + relativedelta(months=1)).strftime("%Y-%m-%d")
        else:
            end_date = f"{current_year}-{current_month}-{day_joined}"
            start_date = ((datetime.strptime(end_date, "%Y-%m-%d").date() - relativedelta(months=1)).strftime("%Y-%m-%d"))
        limit = UsageVariables.FREE_PLAN_CREDIT_LIMIT
        plan = UsageVariables.FREE_PLAN
        total_credits = RunUsage.credits_calculation(self, user_id, start_date, end_date)
        return limit > total_credits
    
class MicroAppUsage:
    @staticmethod
    def microapp_related_info(user_id):
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
            # Get the subscription object
            subscription_obj = Subscription.objects.get(id=subscription["id"])
            # Get max_apps from subscription configuration
            max_apps = get_subscription_max_apps(subscription_obj)
            
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
                "user_ip": ip
            }
        sessions = Run.objects.filter(**filters).count()
        sessions = Run.objects.filter(**filters).distinct("session_id").count()
        return sessions

    @staticmethod
    def get_run_related_info(self, ip):
        sessions = GuestUsage.get_user_sessions(self, ip)
        return sessions < UsageVariables.GUEST_USER_SESSION_LIMIT
