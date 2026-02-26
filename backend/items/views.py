"""
Views for Item API endpoints.
"""
from rest_framework import viewsets, permissions
from items.models import Item
from items.serializers import ItemSerializer
from core.permissions import IsSystemAdmin


class ItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Item CRUD operations.
    
    - List/Retrieve: All authenticated users
    - Create/Update/Delete: System admins only
    """
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    pagination_class = None  # Disable pagination
    
    def get_permissions(self):
        """
        Set permissions based on action.
        
        - List and retrieve: Any authenticated user
        - Create, update, delete: System admins only
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [permissions.IsAuthenticated, IsSystemAdmin]
        else:
            permission_classes = [permissions.IsAuthenticated]
        
        return [permission() for permission in permission_classes]
