from django.contrib import messages
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from apps.teams.decorators import login_and_team_required


def home(request):
    if request.user.is_authenticated:
        return HttpResponseRedirect(reverse("web:dashboard"))
       
    else:
        return render(request, "web/landing_page.html")


@login_and_team_required
def team_home(request, team_slug):
    assert request.team.slug == team_slug
    return render(
        request,
        "web/app_home.html",
        context={
            "team": request.team,
            "active_tab": "dashboard",
            "page_title": _("{team} Dashboard").format(team=request.team),
        },
    )


def simulate_error(request):
    raise Exception("This is a simulated error.")

# custom views

def library_view(request):
    return render(request, "web/web-micro-ai-library.html")


def mcqs_view(request):
    return render(request, "web/mcqs-generator.html")