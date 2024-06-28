from django.http import HttpResponseRedirect
from django.views.decorators.http import require_POST

from apps.subscriptions.helpers import create_stripe_portal_session
from apps.teams.decorators import team_admin_required


@team_admin_required
@require_POST
def create_portal_session(request, team_slug):
    subscription_holder = request.team
    portal_session = create_stripe_portal_session(subscription_holder)
    return HttpResponseRedirect(portal_session.url)
