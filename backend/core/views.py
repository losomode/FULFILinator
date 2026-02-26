"""
Core views for FULFILinator.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, viewsets
from core.models import Attachment, AdminOverride
from core.serializers import AttachmentSerializer, AdminOverrideSerializer
from core.permissions import CanEditData, IsSystemAdmin


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify the service is running.
    Returns 200 OK with service information.
    """
    return Response({
        'status': 'ok',
        'service': 'FULFILinator',
        'version': '1.0.0'
    }, status=status.HTTP_200_OK)


class AttachmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing attachments.
    
    Supports:
    - List: GET /api/fulfil/attachments/?content_type=PO&object_id=1
    - Create: POST /api/fulfil/attachments/ (multipart/form-data)
    - Retrieve: GET /api/fulfil/attachments/{id}/
    - Delete: DELETE /api/fulfil/attachments/{id}/
    """
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter attachments by content_type and object_id query parameters.
        """
        queryset = super().get_queryset()
        
        content_type = self.request.query_params.get('content_type')
        object_id = self.request.query_params.get('object_id')
        
        if content_type:
            queryset = queryset.filter(content_type=content_type)
        if object_id:
            queryset = queryset.filter(object_id=object_id)
        
        return queryset
    
    def perform_create(self, serializer):
        """
        Set uploaded_by_user_id from authenticated user when creating attachment.
        """
        serializer.save(uploaded_by_user_id=str(self.request.user.id))


class AdminOverrideViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing admin override history (read-only).
    
    Only system admins can access this endpoint.
    
    Supports filtering by:
    - entity_type: Filter by PO, ORDER, or DELIVERY
    - entity_id: Filter by specific entity ID
    - user_id: Filter by user who performed the override
    
    Example:
    - GET /api/fulfil/admin-overrides/
    - GET /api/fulfil/admin-overrides/?entity_type=PO&entity_id=1
    - GET /api/fulfil/admin-overrides/?user_id=123
    """
    queryset = AdminOverride.objects.all()
    serializer_class = AdminOverrideSerializer
    permission_classes = [IsSystemAdmin]
    
    def get_queryset(self):
        """
        Filter overrides by query parameters.
        """
        queryset = super().get_queryset()
        
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        user_id = self.request.query_params.get('user_id')
        
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type.upper())
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset
