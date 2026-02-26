from django.contrib import admin
from orders.models import Order, OrderLineItem


class OrderLineItemInline(admin.TabularInline):
    """Inline admin for order line items."""
    model = OrderLineItem
    extra = 1
    fields = ['item', 'quantity', 'price_per_unit', 'po_line_item', 'notes', 'override_reason']
    raw_id_fields = ['item', 'po_line_item']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    """Admin interface for Order model."""
    list_display = ['order_number', 'customer_id', 'status', 'created_at', 'created_by_user_id']
    list_filter = ['status', 'created_at']
    search_fields = ['order_number', 'customer_id', 'notes']
    readonly_fields = ['order_number', 'created_at', 'updated_at', 'closed_at']
    inlines = [OrderLineItemInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order_number', 'customer_id', 'status', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'created_by_user_id', 'closed_at', 'closed_by_user_id')
        }),
    )
