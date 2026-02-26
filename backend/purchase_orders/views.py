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
from notifications.utils import send_po_ready_to_close_email


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
        Get queryset with customer data isolation and filtering.
        System admins see all, customer users see only their own.
        
        Query params:
        - customer_id: Filter by customer
        - status: Filter by status (OPEN/CLOSED)
        - start_date_after: Filter POs starting after this date
        - start_date_before: Filter POs starting before this date
        - expiration_date_after: Filter POs expiring after this date
        - expiration_date_before: Filter POs expiring before this date
        """
        user = self.request.user
        
        if user.is_system_admin():
            queryset = PurchaseOrder.objects.all()
        else:
            # Customer users only see their own customer's POs
            queryset = PurchaseOrder.objects.filter(customer_id=user.customer_id)
        
        # Apply filters from query params
        customer_id = self.request.query_params.get('customer_id')
        if customer_id and user.is_system_admin():
            queryset = queryset.filter(customer_id=customer_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        
        start_date_after = self.request.query_params.get('start_date_after')
        if start_date_after:
            queryset = queryset.filter(start_date__gte=start_date_after)
        
        start_date_before = self.request.query_params.get('start_date_before')
        if start_date_before:
            queryset = queryset.filter(start_date__lte=start_date_before)
        
        expiration_date_after = self.request.query_params.get('expiration_date_after')
        if expiration_date_after:
            queryset = queryset.filter(expiration_date__gte=expiration_date_after)
        
        expiration_date_before = self.request.query_params.get('expiration_date_before')
        if expiration_date_before:
            queryset = queryset.filter(expiration_date__lte=expiration_date_before)
        
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
        Close a purchase order.
        Sets status to CLOSED, closed_at to now, and closed_by_user_id.
        Validates that PO is ready to close (all items fulfilled or waived).
        Admin can force close with override flag.
        """
        purchase_order = self.get_object()
        
        if purchase_order.status == 'CLOSED':
            return Response(
                {'error': 'Purchase order is already closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if PO is ready to close
        admin_override = request.data.get('admin_override', False)
        if not purchase_order.is_ready_to_close() and not admin_override:
            return Response(
                {
                    'error': 'Cannot close purchase order. Not all items are fulfilled or waived.',
                    'can_override': True,
                    'message': 'Set admin_override=true and provide override_reason to force close.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If override, require reason and log it
        if admin_override and not purchase_order.is_ready_to_close():
            override_reason = request.data.get('override_reason', '').strip()
            if not override_reason:
                return Response(
                    {'error': 'override_reason is required when using admin_override.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Log the override
            from core.models import AdminOverride
            AdminOverride.objects.create(
                entity_type='PO',
                entity_id=purchase_order.id,
                entity_number=purchase_order.po_number,
                override_type='CLOSE',
                reason=override_reason,
                user_id=request.user.id,
                user_email=request.user.email,
                metadata={'unfulfilled_items': True}
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
            "quantity_to_waive": <int>,
            "reason": <string> (optional but recommended)
        }
        """
        from django.db.models import Sum
        
        purchase_order = self.get_object()
        
        if purchase_order.status == 'CLOSED':
            return Response(
                {'error': 'Cannot waive items on a closed purchase order.'},
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
        
        # Calculate ordered quantity
        ordered_quantity = line_item.orderlineitem_set.aggregate(
            total=Sum('quantity')
        )['total'] or 0
        
        # Calculate remaining quantity
        already_waived = line_item.waived_quantity
        remaining_quantity = line_item.quantity - ordered_quantity - already_waived
        
        if quantity_to_waive > remaining_quantity:
            return Response(
                {
                    'error': f'Cannot waive {quantity_to_waive}. Only {remaining_quantity} remaining.',
                    'details': {
                        'original_quantity': line_item.quantity,
                        'ordered_quantity': ordered_quantity,
                        'already_waived': already_waived,
                        'remaining': remaining_quantity
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if PO was ready to close before waiving
        was_ready_to_close = purchase_order.is_ready_to_close()
        
        # Update waived quantity
        line_item.waived_quantity += quantity_to_waive
        line_item.save()
        
        # TODO: Log waive action with reason and user when WaiveLog model is implemented
        
        # Check if PO is now ready to close after waiving
        # Refresh from DB to get updated state
        purchase_order.refresh_from_db()
        if not was_ready_to_close and purchase_order.is_ready_to_close():
            send_po_ready_to_close_email(purchase_order)
        
        return Response({
            'message': f'Successfully waived {quantity_to_waive} units of {line_item.item.name}.',
            'line_item': {
                'id': line_item.id,
                'item': str(line_item.item),
                'original_quantity': line_item.quantity,
                'ordered_quantity': ordered_quantity,
                'waived_quantity': line_item.waived_quantity,
                'remaining_quantity': line_item.quantity - ordered_quantity - line_item.waived_quantity
            }
        })
