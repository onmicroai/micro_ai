from django.contrib import messages
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from django.utils.translation import gettext_lazy as _


def health(request):
    return HttpResponse("ok", content_type="text/plain")


def home(request):
    if request.user.is_authenticated:
        return HttpResponseRedirect(reverse("web:dashboard"))
       
    else:
        return render(request, "web/landing_page.html")


def simulate_error(request):
    raise Exception("This is a simulated error.")

# custom views

def library_view(request):
    return render(request, "web/web-micro-ai-library.html")


def mcqs_view(request):
    return render(request, "web/mcqs-generator.html")