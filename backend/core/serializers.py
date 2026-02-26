"""
Serializers for core models.
"""
from rest_framework import serializers
from core.models import Attachment, AdminOverride


class AttachmentSerializer(serializers.ModelSerializer):
    """Serializer for Attachment model."""
    
    # Read-only computed properties
    file_extension = serializers.ReadOnlyField()
    file_size_mb = serializers.ReadOnlyField()
    is_image = serializers.ReadOnlyField()
    is_pdf = serializers.ReadOnlyField()
    is_spreadsheet = serializers.ReadOnlyField()
    
    class Meta:
        model = Attachment
        fields = [
            'id',
            'content_type',
            'object_id',
            'file',
            'filename',
            'file_size',
            'uploaded_at',
            'uploaded_by_user_id',
            'file_extension',
            'file_size_mb',
            'is_image',
            'is_pdf',
            'is_spreadsheet',
        ]
        read_only_fields = [
            'id',
            'filename',
            'file_size',
            'uploaded_at',
            'uploaded_by_user_id',  # Set automatically by view
        ]


class AdminOverrideSerializer(serializers.ModelSerializer):
    """Serializer for AdminOverride model (read-only)."""
    
    entity_type_display = serializers.CharField(source='get_entity_type_display', read_only=True)
    override_type_display = serializers.CharField(source='get_override_type_display', read_only=True)
    
    class Meta:
        model = AdminOverride
        fields = [
            'id',
            'entity_type',
            'entity_type_display',
            'entity_id',
            'entity_number',
            'override_type',
            'override_type_display',
            'reason',
            'user_id',
            'user_email',
            'created_at',
            'metadata',
        ]
        # All fields are read-only (this is a read-only viewset)
