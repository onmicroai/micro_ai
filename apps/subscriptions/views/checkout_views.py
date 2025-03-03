from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect
from django.views.decorators.http import require_POST

from apps.subscriptions.helpers import (
    create_stripe_checkout_session,
    get_subscription_urls,
)
from apps.teams.decorators import login_and_team_required
from apps.utils.billing import get_stripe_module


@require_POST
@login_and_team_required
def create_checkout_session(request, team_slug):
    subscription_holder = request.team
    price_id = request.POST["priceId"]
    checkout_session = create_stripe_checkout_session(subscription_holder, price_id, request.user, "", "")
    return HttpResponseRedirect(checkout_session.url)


@login_required
def subscription_confirm(request):
    session_id = request.GET.get("session_id")
    session = get_stripe_module().checkout.Session.retrieve(session_id)
    client_reference_id = int(session.client_reference_id)
    subscription_holder = request.user.teams.select_related("subscription", "customer").get(id=client_reference_id)
    return HttpResponseRedirect(get_subscription_urls(subscription_holder)["subscription_details"])


@login_and_team_required
def checkout_canceled(request, team_slug):
    subscription_holder = request.team
    messages.info(request, "Your upgrade was canceled.")
    return HttpResponseRedirect(get_subscription_urls(subscription_holder)["subscription_details"])
