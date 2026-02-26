from django.contrib import admin
from deliveries.models import Delivery, DeliveryLineItem


class DeliveryLineItemInline(admin.TabularInline):
    """Inline admin for delivery line items."""
    model = DeliveryLineItem
    extra = 1
    fields = ['item', 'serial_number', 'price_per_unit', 'order_line_item', 'notes', 'override_reason']
    raw_id_fields = ['item', 'order_line_item']


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    """Admin interface for Delivery model."""
    list_display = ['delivery_number', 'customer_id', 'ship_date', 'tracking_number', 'status', 'created_at']
    list_filter = ['status', 'ship_date', 'created_at']
    search_fields = ['delivery_number', 'customer_id', 'tracking_number', 'notes']
    readonly_fields = ['delivery_number', 'created_at', 'updated_at', 'closed_at']
    inlines = [DeliveryLineItemInline]
    
    fieldsets = (
        ('Delivery Information', {
            'fields': ('delivery_number', 'customer_id', 'ship_date', 'tracking_number', 'status', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'created_by_user_id', 'closed_at', 'closed_by_user_id')
        }),
    )


@admin.register(DeliveryLineItem)
class DeliveryLineItemAdmin(admin.ModelAdmin):
    """Admin interface for DeliveryLineItem model."""
    list_display = ['delivery', 'item', 'serial_number', 'price_per_unit']
    list_filter = ['item']
    search_fields = ['serial_number', 'delivery__delivery_number', 'item__name']
    raw_id_fields = ['delivery', 'item', 'order_line_item']
