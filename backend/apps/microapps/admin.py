from django.contrib import admin
from .models import MicroAppUserJoin, Microapp, Run, Asset, AssetsMaJoin

class MicroAppUserJoinAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'ma_id', 'role', 'counts_toward_max', 'is_archived')
    list_filter = ('role', 'counts_toward_max', 'is_archived')
    search_fields = ('user_id__email', 'user_id__username', 'user_id__first_name', 'user_id__last_name', 'ma_id__title')
    list_editable = ('role', 'counts_toward_max', 'is_archived')
    ordering = ('ma_id__title', 'user_id__username')
    autocomplete_fields = ['user_id', 'ma_id']
    list_per_page = 50  # Show more items per page for better filtering

class MicroappAdmin(admin.ModelAdmin):
    list_display = ('title', 'privacy', 'is_promoted', 'promo_priority', 'ai_model', 'copy_allowed', 'is_archived', 'hash_id')
    list_filter = ('privacy', 'is_promoted', 'copy_allowed', 'is_archived', 'ai_model')
    search_fields = ('title', 'explanation', 'hash_id')
    list_editable = ('privacy', 'is_promoted', 'promo_priority', 'copy_allowed', 'is_archived')

    def get_queryset(self, request):
        return super().get_queryset(request).order_by_promo_priority()

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.is_promoted and obj.privacy != Microapp.PUBLIC:
            from django.contrib import messages
            messages.warning(
                request,
                f'"{obj.title}" is promoted but privacy is not public — it will not appear on the home or library pages.',
            )

class RunAdmin(admin.ModelAdmin):
    list_display = ('id', 'ma_id', 'user_id', 'ai_model', 'timestamp', 'satisfaction', 'cost', 'credits', 'run_passed')
    list_filter = ('ai_model', 'run_passed', 'scored_run', 'no_submission', 'response_type', 'timestamp')
    search_fields = ('ma_id__title', 'user_id__email', 'user_id__username', 'run_uuid', 'session_id')
    readonly_fields = ('timestamp', 'updated_at')
    ordering = ('-timestamp',)
    autocomplete_fields = ['ma_id', 'user_id', 'owner_id']

class AssetAdmin(admin.ModelAdmin):
    list_display = ('id', 'label', 'file_preview')
    search_fields = ('label',)
    
    def file_preview(self, obj):
        return obj.file[:100] + '...' if len(obj.file) > 100 else obj.file
    file_preview.short_description = 'File Preview'

class AssetsMaJoinAdmin(admin.ModelAdmin):
    list_display = ('ma_id', 'asset_id')
    list_filter = ('ma_id__title',)
    search_fields = ('ma_id__title', 'asset_id__label')
    autocomplete_fields = ['ma_id', 'asset_id']

# Register your models here.

admin.site.register(MicroAppUserJoin, MicroAppUserJoinAdmin)
admin.site.register(Microapp, MicroappAdmin)
admin.site.register(Run, RunAdmin)
admin.site.register(Asset, AssetAdmin)
admin.site.register(AssetsMaJoin, AssetsMaJoinAdmin)
