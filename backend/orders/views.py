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
        Get queryset with customer data isolation.
        System admins see all, customer users see only their own.
        """
        user = self.request.user
        
        if user.is_system_admin():
            return Order.objects.all().order_by('-created_at')
        else:
            # Customer users only see their own customer's orders
            return Order.objects.filter(
                customer_id=user.customer_id
            ).order_by('-created_at')
    
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
        """
        order = self.get_object()
        
        if order.status == 'CLOSED':
            return Response(
                {'error': 'Order is already closed.'},
                status=status.HTTP_400_BAD_REQUEST
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
            "quantity_to_waive": <int>
        }
        
        Note: For now, this is a placeholder that validates the request.
        Actual waiving logic will be implemented when deliveries app is complete,
        as it needs to track waived quantities against deliveries.
        """
        order = self.get_object()
        
        line_item_id = request.data.get('line_item_id')
        quantity_to_waive = request.data.get('quantity_to_waive')
        
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
        
        # For now, delivered_quantity is 0 since deliveries app not implemented
        delivered_quantity = 0
        remaining_quantity = line_item.quantity - delivered_quantity
        
        if quantity_to_waive > remaining_quantity:
            return Response(
                {'error': f'Cannot waive {quantity_to_waive}. Only {remaining_quantity} remaining.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Implement actual waiving logic when deliveries app is complete
        # For now, just return success message
        return Response({
            'message': f'Waived {quantity_to_waive} units of {line_item.item.name}. '
                      f'Remaining: {remaining_quantity - quantity_to_waive}'
        })
