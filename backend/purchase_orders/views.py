"""
Views for purchase_orders app.
"""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.authentication import AuthinatorJWTAuthentication
from core.permissions import IsSystemAdmin, CustomerDataIsolation
from purchase_orders.models import PurchaseOrder, POLineItem
from purchase_orders.serializers import PurchaseOrderSerializer


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PurchaseOrder CRUD operations.
    
    - List/Retrieve: All authenticated users (with customer data isolation)
    - Create/Update/Delete: System admins only
    - Custom actions: close, waive (system admins only)
    """
    
    serializer_class = PurchaseOrderSerializer
    authentication_classes = [AuthinatorJWTAuthentication]
    
    def get_queryset(self):
        """
        Get queryset with customer data isolation.
        System admins see all, customer users see only their own.
        """
        user = self.request.user
        
        if user.is_system_admin():
            return PurchaseOrder.objects.all().order_by('-created_at')
        else:
            # Customer users only see their own customer's POs
            return PurchaseOrder.objects.filter(
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
        Close a purchase order.
        Sets status to CLOSED, closed_at to now, and closed_by_user_id.
        """
        purchase_order = self.get_object()
        
        if purchase_order.status == 'CLOSED':
            return Response(
                {'error': 'Purchase order is already closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        purchase_order.status = 'CLOSED'
        purchase_order.closed_at = timezone.now()
        purchase_order.closed_by_user_id = request.user.id
        purchase_order.save()
        
        serializer = self.get_serializer(purchase_order)
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
        Actual waiving logic will be implemented when orders app is complete,
        as it needs to track waived quantities against orders.
        """
        purchase_order = self.get_object()
        
        line_item_id = request.data.get('line_item_id')
        quantity_to_waive = request.data.get('quantity_to_waive')
        
        if not line_item_id or quantity_to_waive is None:
            return Response(
                {'error': 'line_item_id and quantity_to_waive are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            line_item = POLineItem.objects.get(
                id=line_item_id,
                po=purchase_order
            )
        except POLineItem.DoesNotExist:
            return Response(
                {'error': 'Line item not found for this purchase order.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate quantity_to_waive
        if quantity_to_waive <= 0:
            return Response(
                {'error': 'Quantity to waive must be positive.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # For now, ordered_quantity is 0 since orders app not implemented
        ordered_quantity = 0
        remaining_quantity = line_item.quantity - ordered_quantity
        
        if quantity_to_waive > remaining_quantity:
            return Response(
                {'error': f'Cannot waive {quantity_to_waive}. Only {remaining_quantity} remaining.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Implement actual waiving logic when orders app is complete
        # For now, just return success message
        return Response({
            'message': f'Waived {quantity_to_waive} units of {line_item.item.name}. '
                      f'Remaining: {remaining_quantity - quantity_to_waive}'
        })
