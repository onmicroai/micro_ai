from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect

from apps.subscriptions.helpers import (
    get_subscription_urls,
)
from apps.utils.billing import get_stripe_module


@login_required
def subscription_confirm(request):
    session_id = request.GET.get("session_id")
    session = get_stripe_module().checkout.Session.retrieve(session_id)
    client_reference_id = int(session.client_reference_id)
    subscription_holder = request.user.teams.select_related("subscription", "customer").get(id=client_reference_id)
    return HttpResponseRedirect(get_subscription_urls(subscription_holder)["subscription_details"])