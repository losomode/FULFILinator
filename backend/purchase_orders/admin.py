from django.contrib import admin
from purchase_orders.models import PurchaseOrder, POLineItem


class POLineItemInline(admin.TabularInline):
    """Inline admin for PO line items."""
    model = POLineItem
    extra = 1
    fields = ['item', 'quantity', 'price_per_unit', 'notes']


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    """Admin interface for PurchaseOrder model."""
    list_display = ['po_number', 'customer_id', 'status', 'start_date', 'expiration_date', 'created_at']
    list_filter = ['status', 'created_at', 'start_date']
    search_fields = ['po_number', 'notes']
    readonly_fields = ['po_number', 'created_at', 'updated_at', 'closed_at']
    inlines = [POLineItemInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('po_number', 'customer_id', 'status')
        }),
        ('Dates', {
            'fields': ('start_date', 'expiration_date')
        }),
        ('References', {
            'fields': ('google_doc_url', 'hubspot_url', 'notes')
        }),
        ('Metadata', {
            'fields': ('created_by_user_id', 'created_at', 'updated_at', 'closed_by_user_id', 'closed_at')
        }),
    )


@admin.register(POLineItem)
class POLineItemAdmin(admin.ModelAdmin):
    """Admin interface for POLineItem model."""
    list_display = ['po', 'item', 'quantity', 'price_per_unit']
    list_filter = ['po__status']
    search_fields = ['po__po_number', 'item__name']
