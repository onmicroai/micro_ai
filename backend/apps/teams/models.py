import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext
from waffle.models import AbstractUserFlag

from apps.subscriptions.models import SubscriptionModelBase
from apps.utils.models import BaseModel

# Define roles directly as constants since roles.py isn't available
ROLE_ADMIN = 'admin'
ROLE_MEMBER = 'member'
ROLE_CHOICES = [
    (ROLE_ADMIN, 'Admin'),
    (ROLE_MEMBER, 'Member'),
]


class Team(SubscriptionModelBase, BaseModel):
    """
    A Team, with members. Simplified model for database compatibility.
    """
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="teams", through="Membership")

    def __str__(self):
        return self.name


class Membership(BaseModel):
    """
    A user's team membership. Simplified model for database compatibility.
    """
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=100, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.user}: {self.team}"

    class Meta:
        # Ensure a user can only be associated with a team once.
        unique_together = ("team", "user")


class Invitation(BaseModel):
    """
    An invitation for new team members. Simplified model for database compatibility.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=100, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_invitations")
    is_accepted = models.BooleanField(default=False)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accepted_invitations", null=True, blank=True
    )


class BaseTeamModel(BaseModel):
    """
    Abstract model for objects that are part of a team.
    """
    team = models.ForeignKey(Team, verbose_name=gettext("Team"), on_delete=models.CASCADE)

    class Meta:
        abstract = True


class Flag(AbstractUserFlag):
    """Custom Waffle flag model. Keeping only database fields."""
    FLAG_TEAMS_CACHE_KEY = "FLAG_TEAMS_CACHE_KEY"
    FLAG_TEAMS_CACHE_KEY_DEFAULT = "flag:%s:teams"

    teams = models.ManyToManyField(
        Team,
        blank=True,
        help_text=gettext("Activate this flag for these teams."),
    )