"""
Views for deliveries app.
"""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.authentication import AuthinatorJWTAuthentication
from core.permissions import IsSystemAdmin, CustomerDataIsolation
from deliveries.models import Delivery, DeliveryLineItem
from deliveries.serializers import DeliverySerializer, DeliveryLineItemSerializer


class DeliveryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Delivery CRUD operations.
    
    - List/Retrieve: All authenticated users (with customer data isolation)
    - Create/Update/Delete: System admins only
    - Custom actions: close, search_serial (system admins only)
    """
    
    serializer_class = DeliverySerializer
    authentication_classes = [AuthinatorJWTAuthentication]
    
    def get_queryset(self):
        """
        Get queryset with customer data isolation.
        System admins see all, customer users see only their own.
        """
        user = self.request.user
        
        if user.is_system_admin():
            return Delivery.objects.all().order_by('-created_at')
        else:
            # Customer users only see their own customer's deliveries
            return Delivery.objects.filter(
                customer_id=user.customer_id
            ).order_by('-created_at')
    
    def get_permissions(self):
        """
        Set permissions based on action.
        - list, retrieve, search_serial: authenticated with data isolation
        - create, update, partial_update, destroy: system admins only
        - close: system admins only
        """
        if self.action in ['list', 'retrieve', 'search_serial']:
            permission_classes = [CustomerDataIsolation]
        else:
            permission_classes = [IsSystemAdmin]
        
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['post'], permission_classes=[IsSystemAdmin])
    def close(self, request, pk=None):
        """
        Close a delivery.
        Sets status to CLOSED, closed_at to now, and closed_by_user_id.
        """
        delivery = self.get_object()
        
        if delivery.status == 'CLOSED':
            return Response(
                {'error': 'Delivery is already closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        delivery.status = 'CLOSED'
        delivery.closed_at = timezone.now()
        delivery.closed_by_user_id = request.user.id
        delivery.save()
        
        serializer = self.get_serializer(delivery)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[CustomerDataIsolation])
    def search_serial(self, request):
        """
        Search for a delivery by serial number.
        
        Query params:
        - serial_number: The serial number to search for
        
        Returns the delivery line item and parent delivery.
        """
        serial_number = request.query_params.get('serial_number')
        
        if not serial_number:
            return Response(
                {'error': 'serial_number query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            line_item = DeliveryLineItem.objects.select_related(
                'delivery', 'item', 'order_line_item__order'
            ).get(serial_number=serial_number)
            
            # Check customer data isolation
            user = request.user
            if not user.is_system_admin():
                if line_item.delivery.customer_id != user.customer_id:
                    return Response(
                        {'error': 'Serial number not found.'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            # Serialize the line item
            line_item_serializer = DeliveryLineItemSerializer(line_item)
            delivery_serializer = DeliverySerializer(line_item.delivery)
            
            return Response({
                'line_item': line_item_serializer.data,
                'delivery': delivery_serializer.data
            })
            
        except DeliveryLineItem.DoesNotExist:
            return Response(
                {'error': 'Serial number not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
