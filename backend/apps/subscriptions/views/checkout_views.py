from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect

from apps.subscriptions.helpers import (
    get_subscription_urls,
)


@login_required
def subscription_confirm():
    return HttpResponseRedirect(get_subscription_urls()["subscription_details"])