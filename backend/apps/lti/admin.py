from django.contrib import admin
from .models import LTIConfig


@admin.register(LTIConfig)
class LTIConfigAdmin(admin.ModelAdmin):
    list_display = ('issuer', 'client_id', 'microapp', 'registration_type')
    list_filter = ('issuer',)
    search_fields = ('issuer', 'client_id', 'deployment_ids', 'microapp__title')
    autocomplete_fields = ('microapp',)
    fieldsets = (
        (
            'Scope',
            {
                'fields': ('microapp',),
                'description': (
                    'Leave <strong>Microapp</strong> blank for an account-level '
                    'registration (e.g. a Canvas Developer Key) where instructors '
                    'pick an app via deep linking. Set it only for a single-app '
                    'registration such as the Open edX flow.'
                ),
            },
        ),
        (
            'Platform credentials (from the LMS)',
            {
                'fields': (
                    'issuer',
                    'client_id',
                    'auth_login_url',
                    'auth_token_url',
                    'key_set_url',
                    'deployment_ids',
                ),
            },
        ),
    )

    @admin.display(description='Type')
    def registration_type(self, obj):
        return 'Single app' if obj.microapp_id else 'Account-level (deep linking)'
