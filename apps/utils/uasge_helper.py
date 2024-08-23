from apps.microapps.models import Run
from djstripe.models import Subscription
from apps.subscriptions.serializers import CustomSubscriptionSerilaizer
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

def check_plan(plan):
        if plan == 1:
            return{"limit": UsageVariables.FREE_PLAN_LIMIT, "plan": UsageVariables.FREE_PLAN}
        elif plan == 2:
            return{"limit": UsageVariables.ENTERPRISE_PLAN_LIMIT, "plan": UsageVariables.ENTERPRISE_PLAN}
        else:
            return{"limit": UsageVariables.INDIVIDUAL_PLAN_LIMIT, "plan": UsageVariables.INDIVIDUAL_PLAN} 

class RunUsage:
    
    def format_date(self, start_date, end_date):
        start = datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')
        return {"start":start, "end":end}
    
    def cost_calculation(self, user_id, start_date, end_date):
        filters = {
                "owner_id": user_id,
                "timestamp__date__gte": start_date,
                "timestamp__date__lte": end_date
            }
        filters = {k: v for k, v in filters.items() if v is not None}
        queryset = Run.objects.filter(**filters).aggregate(total_cost = Sum('cost'))
        return queryset["total_cost"] if queryset["total_cost"] else UsageVariables.DEFAULT_TOTAL_COST

    @staticmethod
    def get_run_related_info(self, user_id, date_joined):
        subscription = subscription_details(user_id)
        # enterprise and individual plan implementation
        if subscription and subscription["status"] == "active":
            date = RunUsage.format_date(self, subscription["current_period_start"], subscription["current_period_end"])
            limit_plan = check_plan(subscription["plan"])
            limit = limit_plan["limit"]
            plan = limit_plan["plan"]
            total_cost = RunUsage.cost_calculation(self, user_id, date["start"], date["end"])
            return limit > total_cost
        # default free plan implementation
        day_joined = datetime.strptime(date_joined, "%Y-%m-%dT%H:%M:%S.%fZ").date().strftime("%d")
        current_month = datetime.now().strftime("%m")
        current_year = datetime.now().strftime("%Y")
        if datetime.now().strftime("%d") > day_joined:
            start_date = f"{current_year}-{current_month}-{day_joined}"
            end_date = (datetime.strptime(start_date, "%Y-%m-%d").date() + relativedelta(months=1)).strftime("%Y-%m-%d")
        else:
            end_date = f"{current_year}-{current_month}-{day_joined}"
            start_date = ((datetime.strptime(end_date, "%Y-%m-%d").date() - relativedelta(months=1)).strftime("%Y-%m-%d"))
        limit = UsageVariables.FREE_PLAN_LIMIT
        plan = UsageVariables.FREE_PLAN
        total_cost = RunUsage.cost_calculation(self, user_id, start_date, end_date)
        return limit > total_cost
    
class MicroAppUasge:

    @staticmethod
    def microapp_related_info(user_id):
        subscription = subscription_details(user_id)
        userapps = MicroAppUserJoin.objects.filter(user_id=user_id, role="owner").aggregate(count = Count("id"))
        if subscription and subscription["status"] == "active":
            if subscription["plan"] == 1:
                return userapps["count"] > UsageVariables.FREE_PLAN_MICROAPP_LIMIT  
            else:
                return True
        return userapps["count"] > UsageVariables.FREE_PLAN_MICROAPP_LIMIT
