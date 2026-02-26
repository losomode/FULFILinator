from django.contrib import admin
from items.models import Item


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    """Admin interface for Item model."""
    list_display = ['name', 'version', 'msrp', 'min_price', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'version', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'version', 'description')
        }),
        ('Pricing', {
            'fields': ('msrp', 'min_price')
        }),
        ('Metadata', {
            'fields': ('created_by_user_id', 'created_at', 'updated_at')
        }),
    )
