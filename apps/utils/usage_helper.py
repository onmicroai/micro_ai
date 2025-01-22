from apps.microapps.models import Run
from djstripe.models import Subscription, Plan
from apps.subscriptions.serializers import CustomSubscriptionSerilaizer, PlansSerializer
from datetime import datetime
from django.db.models import Sum
from dateutil.relativedelta import relativedelta
from apps.utils.global_varibales import UsageVariables
from apps.microapps.models import MicroAppUserJoin
from apps.microapps.serializer import MicroappUserSerializer
from django.db.models import Count

def subscription_details(user_id):
    subscription = Subscription.objects.filter(metadata__contains={'user_id': str(user_id)})
    if subscription:
        serializer = CustomSubscriptionSerilaizer(subscription, many=True)
        return serializer.data[0]
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
        # Enterprise and individual plan implementation
        if subscription and subscription["status"] == "active":
            plans = Plan.objects.get(djstripe_id=subscription["plan"])
            plan_data = PlansSerializer(plans)
            limit_plan = check_plan(plan_data.data["amount"])
            limit = limit_plan["limit"]
            plan = limit_plan["plan"]
            date = RunUsage.format_date(self, subscription["current_period_start"], subscription["current_period_end"])
            # Coverting string formatted date into datetime
            start_date = datetime.strptime(subscription["current_period_start"], '%Y-%m-%dT%H:%M:%SZ')
            end_date = datetime.strptime(subscription["current_period_end"], '%Y-%m-%dT%H:%M:%SZ')
            # Check for annual and monthly subscription plan
            plan_type = end_date.month - start_date.month + 12 * (end_date.year - start_date.year)
            # Monthly subscription conditional check
            if plan_type == 1 or plan_type == 0:
                start_date = date["start"]      
                end_date = date["end"]
            # Annual subscription conditional check
            else:
                current_date = datetime.now()
                difference = relativedelta(current_date, start_date)
                months_passed = (difference.years * 12) + difference.months
                # Current month is the start of subscription
                if months_passed == 0:
                    start_date = date["start"]
                    end_date = date["end"]
                # Current month is the following of subscription months 
                else:
                    adjusted_start_date = start_date + relativedelta(months = months_passed)
                    date = RunUsage.format_date(self, adjusted_start_date.strftime('%Y-%m-%dT%H:%M:%SZ'), end_date.strftime('%Y-%m-%dT%H:%M:%SZ'))
                    start_date = date["start"]
                    end_date = date["end"]
            total_credits = RunUsage.credits_calculation(self, user_id, start_date, end_date)
            return limit > total_credits
        
        # Default free plan implementation
        day_joined = datetime.strptime(date_joined, "%Y-%m-%dT%H:%M:%S.%fZ").date().strftime("%d")
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
            user_id = user_id, 
            role = "owner", 
            counts_toward_max = True, 
            is_archived = False).aggregate(count = Count("id"))

        # If user has an active subscription
        if subscription and subscription["status"] == "active":
            # Get the plan details
            plans = Plan.objects.get(djstripe_id=subscription["plan"])
            plan_data = PlansSerializer(plans)
            
            # If user is on a free plan (monthly or yearly)
            if plan_data.data["amount"] == UsageVariables.FREE_PLAN_AMOUNT_MONTH or plan_data.data["amount"] == UsageVariables.FREE_PLAN_AMOUNT_YEAR:
                # Check if they're under the free plan limit
                return userapps["count"] < UsageVariables.FREE_PLAN_MICROAPP_LIMIT  
            else:
                # For paid plans (Individual/Enterprise), no limit on microapps
                return True
                
        # No active subscription - treat as free plan
        return userapps["count"] < UsageVariables.FREE_PLAN_MICROAPP_LIMIT

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
