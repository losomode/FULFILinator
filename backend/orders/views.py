"""
Views for orders app.
"""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.authentication import AuthinatorJWTAuthentication
from core.permissions import IsSystemAdmin, CustomerDataIsolation
from orders.models import Order, OrderLineItem
from orders.serializers import OrderSerializer
from notifications.utils import send_order_ready_to_close_email


class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Order CRUD operations.
    
    - List/Retrieve: All authenticated users (with customer data isolation)
    - Create/Update/Delete: System admins only
    - Custom actions: close, waive (system admins only)
    """
    
    serializer_class = OrderSerializer
    authentication_classes = [AuthinatorJWTAuthentication]
    
    def get_queryset(self):
        """
        Get queryset with customer data isolation and filtering.
        System admins see all, customer users see only their own.
        
        Query params:
        - customer_id: Filter by customer
        - status: Filter by status (OPEN/CLOSED)
        - created_after: Filter orders created after this date
        - created_before: Filter orders created before this date
        """
        user = self.request.user
        
        if user.is_system_admin():
            queryset = Order.objects.all()
        else:
            # Customer users only see their own customer's orders
            queryset = Order.objects.filter(customer_id=user.customer_id)
        
        # Apply filters from query params
        customer_id = self.request.query_params.get('customer_id')
        if customer_id and user.is_system_admin():
            queryset = queryset.filter(customer_id=customer_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        
        created_after = self.request.query_params.get('created_after')
        if created_after:
            queryset = queryset.filter(created_at__gte=created_after)
        
        created_before = self.request.query_params.get('created_before')
        if created_before:
            queryset = queryset.filter(created_at__lte=created_before)
        
        return queryset.order_by('-created_at')
    
    def get_permissions(self):
        """
        Set permissions based on action.
        - list, retrieve: authenticated with data isolation
        - create, update, partial_update, destroy: system admins only
        - close, waive: system admins only
        """
        if self.action in ['list', 'retrieve']:
            permission_classes = [CustomerDataIsolation]
        else:
            permission_classes = [IsSystemAdmin]
        
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['post'], permission_classes=[IsSystemAdmin])
    def close(self, request, pk=None):
        """
        Close an order.
        Sets status to CLOSED, closed_at to now, and closed_by_user_id.
        Validates that Order is ready to close (all items delivered or waived).
        Admin can force close with override flag.
        """
        order = self.get_object()
        
        if order.status == 'CLOSED':
            return Response(
                {'error': 'Order is already closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if Order is ready to close
        admin_override = request.data.get('admin_override', False)
        if not order.is_ready_to_close() and not admin_override:
            return Response(
                {
                    'error': 'Cannot close order. Not all items are delivered or waived.',
                    'can_override': True,
                    'message': 'Set admin_override=true and provide override_reason to force close.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If override, require reason and log it
        if admin_override and not order.is_ready_to_close():
            override_reason = request.data.get('override_reason', '').strip()
            if not override_reason:
                return Response(
                    {'error': 'override_reason is required when using admin_override.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Log the override
            from core.models import AdminOverride
            AdminOverride.objects.create(
                entity_type='ORDER',
                entity_id=order.id,
                entity_number=order.order_number,
                override_type='CLOSE',
                reason=override_reason,
                user_id=request.user.id,
                user_email=request.user.email,
                metadata={'undelivered_items': True}
            )
        
        order.status = 'CLOSED'
        order.closed_at = timezone.now()
        order.closed_by_user_id = request.user.id
        order.save()
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsSystemAdmin])
    def waive(self, request, pk=None):
        """
        Waive remaining quantity for a line item.
        
        Expected payload:
        {
            "line_item_id": <int>,
            "quantity_to_waive": <int>,
            "reason": <string> (optional but recommended)
        }
        """
        order = self.get_object()
        
        if order.status == 'CLOSED':
            return Response(
                {'error': 'Cannot waive items on a closed order.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        line_item_id = request.data.get('line_item_id')
        quantity_to_waive = request.data.get('quantity_to_waive')
        waive_reason = request.data.get('reason', '')
        
        if not line_item_id or quantity_to_waive is None:
            return Response(
                {'error': 'line_item_id and quantity_to_waive are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            line_item = OrderLineItem.objects.get(
                id=line_item_id,
                order=order
            )
        except OrderLineItem.DoesNotExist:
            return Response(
                {'error': 'Line item not found for this order.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate quantity_to_waive
        if quantity_to_waive <= 0:
            return Response(
                {'error': 'Quantity to waive must be positive.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate delivered quantity (each DeliveryLineItem is one physical item)
        delivered_quantity = line_item.deliverylineitem_set.count()
        
        # Calculate remaining quantity
        already_waived = line_item.waived_quantity
        remaining_quantity = line_item.quantity - delivered_quantity - already_waived
        
        if quantity_to_waive > remaining_quantity:
            return Response(
                {
                    'error': f'Cannot waive {quantity_to_waive}. Only {remaining_quantity} remaining.',
                    'details': {
                        'original_quantity': line_item.quantity,
                        'delivered_quantity': delivered_quantity,
                        'already_waived': already_waived,
                        'remaining': remaining_quantity
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if Order was ready to close before waiving
        was_ready_to_close = order.is_ready_to_close()
        
        # Update waived quantity
        line_item.waived_quantity += quantity_to_waive
        line_item.save()
        
        # TODO: Log waive action with reason and user when WaiveLog model is implemented
        
        # Check if Order is now ready to close after waiving
        # Refresh from DB to get updated state
        order.refresh_from_db()
        if not was_ready_to_close and order.is_ready_to_close():
            send_order_ready_to_close_email(order)
        
        return Response({
            'message': f'Successfully waived {quantity_to_waive} units of {line_item.item.name}.',
            'line_item': {
                'id': line_item.id,
                'item': str(line_item.item),
                'original_quantity': line_item.quantity,
                'delivered_quantity': delivered_quantity,
                'waived_quantity': line_item.waived_quantity,
                'remaining_quantity': line_item.quantity - delivered_quantity - line_item.waived_quantity
            }
        })
