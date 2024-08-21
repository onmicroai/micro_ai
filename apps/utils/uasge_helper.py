from apps.microapps.models import Run
from djstripe.models import Subscription
from apps.subscriptions.serializers import CustomSubscriptionSerilaizer
from datetime import datetime
from django.db.models import Sum

def subscription_details(user_id):
    subscription = Subscription.objects.filter(metadata__contains={'user_id': str(user_id)})
    serializer = CustomSubscriptionSerilaizer(subscription, many=True)
    return serializer.data[0]

class RunUsage:
    
    def format_date(self, start_date, end_date):
        start = datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')
        return {start, end}

    def check_plan(self, plan):
        if plan == 1:
            return{"limit": 3, "plan": "free"}
        elif plan == 2:
            return{"limit": 40, "plan": "enterprise"}
        else:
            return{"limit": 10, "plan": "individual"} 
    
    def cost_calculation(user_id, start_date, end_date):
        filters = {
                "user_id": user_id,
                "timestamp__date__gte": start_date,
                "timestamp__date__lte": end_date
            }
        filters = {k: v for k, v in filters.items() if v is not None}
        queryset = Run.objects.filter(**filters).aggregate(total_cost = Sum('cost'))
        return queryset["total_cost"] if queryset["total_cost"] else 0

    def get_run_related_info(self, user_id):
        subscription = subscription_details(user_id)
        end_date, start_date = self.format_date(subscription["current_period_start"], subscription["current_period_end"])
        limit, plan = self.check_plan(subscription["plan"])
        total_cost = self.cost_calculation(user_id, start_date, end_date)
        return {
            "end_date": end_date,
            "start_date": start_date,
            "limit": limit,
            "plan": plan,
            "total_cost": total_cost
        }



