"""
Dashboard views for FULFILinator.

Provides metrics and alerts for system admins and customers.
"""
from datetime import date, timedelta
from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.authentication import AuthinatorJWTAuthentication
from core.permissions import CustomerDataIsolation
from purchase_orders.models import PurchaseOrder
from orders.models import Order
from deliveries.models import Delivery


@api_view(['GET'])
@permission_classes([CustomerDataIsolation])
def metrics(request):
    """
    Get dashboard metrics.
    
    Returns:
    - PO metrics: open count, expiring soon, ready to close
    - Order metrics: open count, ready to close
    - Delivery metrics: open count, closed this month
    - Fulfillment rates
    
    Filtered by user role:
    - System admins see all
    - Customers see only their data
    """
    user = request.user
    
    # Base querysets with customer isolation
    if user.is_system_admin():
        pos = PurchaseOrder.objects.all()
        orders = Order.objects.all()
        deliveries = Delivery.objects.all()
    else:
        pos = PurchaseOrder.objects.filter(customer_id=user.customer_id)
        orders = Order.objects.filter(customer_id=user.customer_id)
        deliveries = Delivery.objects.filter(customer_id=user.customer_id)
    
    # PO metrics
    po_open_count = pos.filter(status='OPEN').count()
    po_closed_count = pos.filter(status='CLOSED').count()
    po_total_count = pos.count()
    
    # POs expiring soon (within 30 days)
    thirty_days_from_now = date.today() + timedelta(days=30)
    po_expiring_soon = pos.filter(
        status='OPEN',
        expiration_date__lte=thirty_days_from_now,
        expiration_date__gte=date.today()
    ).count()
    
    # POs ready to close
    po_ready_to_close = sum(1 for po in pos.filter(status='OPEN') if po.is_ready_to_close())
    
    # Order metrics
    order_open_count = orders.filter(status='OPEN').count()
    order_closed_count = orders.filter(status='CLOSED').count()
    order_total_count = orders.count()
    
    # Orders ready to close
    order_ready_to_close = sum(1 for order in orders.filter(status='OPEN') if order.is_ready_to_close())
    
    # Delivery metrics
    delivery_open_count = deliveries.filter(status='OPEN').count()
    delivery_closed_count = deliveries.filter(status='CLOSED').count()
    delivery_total_count = deliveries.count()
    
    # Deliveries closed this month
    first_day_of_month = date.today().replace(day=1)
    delivery_closed_this_month = deliveries.filter(
        status='CLOSED',
        closed_at__gte=first_day_of_month
    ).count()
    
    # Customer count (for system admins)
    if user.is_system_admin():
        # Count unique customer IDs across all entities
        customer_ids = set()
        customer_ids.update(pos.values_list('customer_id', flat=True).distinct())
        customer_ids.update(orders.values_list('customer_id', flat=True).distinct())
        customer_ids.update(deliveries.values_list('customer_id', flat=True).distinct())
        customer_count = len(customer_ids)
    else:
        customer_count = 1  # Current customer only
    
    # Fulfillment rates
    po_fulfillment_rate = (po_closed_count / po_total_count * 100) if po_total_count > 0 else 0
    order_fulfillment_rate = (order_closed_count / order_total_count * 100) if order_total_count > 0 else 0
    
    return Response({
        'purchase_orders': {
            'open': po_open_count,
            'closed': po_closed_count,
            'total': po_total_count,
            'expiring_soon': po_expiring_soon,
            'ready_to_close': po_ready_to_close,
            'fulfillment_rate': round(po_fulfillment_rate, 1),
        },
        'orders': {
            'open': order_open_count,
            'closed': order_closed_count,
            'total': order_total_count,
            'ready_to_close': order_ready_to_close,
            'fulfillment_rate': round(order_fulfillment_rate, 1),
        },
        'deliveries': {
            'open': delivery_open_count,
            'closed': delivery_closed_count,
            'total': delivery_total_count,
            'closed_this_month': delivery_closed_this_month,
        },
        'customers': {
            'count': customer_count,
        },
    })


@api_view(['GET'])
@permission_classes([CustomerDataIsolation])
def alerts(request):
    """
    Get dashboard alerts.
    
    Returns actionable items:
    - POs expiring soon (within 30 days)
    - POs ready to close
    - Orders ready to close
    
    Filtered by user role.
    """
    user = request.user
    
    # Base querysets with customer isolation
    if user.is_system_admin():
        pos = PurchaseOrder.objects.filter(status='OPEN')
        orders = Order.objects.filter(status='OPEN')
    else:
        pos = PurchaseOrder.objects.filter(status='OPEN', customer_id=user.customer_id)
        orders = Order.objects.filter(status='OPEN', customer_id=user.customer_id)
    
    alerts_list = []
    
    # POs expiring soon
    thirty_days_from_now = date.today() + timedelta(days=30)
    expiring_pos = pos.filter(
        expiration_date__lte=thirty_days_from_now,
        expiration_date__gte=date.today()
    ).select_related().order_by('expiration_date')
    
    for po in expiring_pos:
        days_until_expiration = (po.expiration_date - date.today()).days if po.expiration_date else None
        alerts_list.append({
            'type': 'po_expiring_soon',
            'severity': 'warning' if days_until_expiration and days_until_expiration > 7 else 'high',
            'title': f'PO {po.po_number} expiring soon',
            'message': f'Expires in {days_until_expiration} days',
            'entity_type': 'po',
            'entity_id': po.id,
            'entity_number': po.po_number,
            'customer_id': po.customer_id,
            'days_until_expiration': days_until_expiration,
        })
    
    # POs ready to close
    for po in pos:
        if po.is_ready_to_close():
            alerts_list.append({
                'type': 'po_ready_to_close',
                'severity': 'info',
                'title': f'PO {po.po_number} ready to close',
                'message': 'All items have been fulfilled or waived',
                'entity_type': 'po',
                'entity_id': po.id,
                'entity_number': po.po_number,
                'customer_id': po.customer_id,
            })
    
    # Orders ready to close
    for order in orders:
        if order.is_ready_to_close():
            alerts_list.append({
                'type': 'order_ready_to_close',
                'severity': 'info',
                'title': f'Order {order.order_number} ready to close',
                'message': 'All items have been delivered or waived',
                'entity_type': 'order',
                'entity_id': order.id,
                'entity_number': order.order_number,
                'customer_id': order.customer_id,
            })
    
    return Response({'alerts': alerts_list})
