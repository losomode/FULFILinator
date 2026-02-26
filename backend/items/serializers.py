"""
Serializers for Item model.
"""
from rest_framework import serializers
from items.models import Item


class ItemSerializer(serializers.ModelSerializer):
    """Serializer for Item model."""
    
    class Meta:
        model = Item
        fields = [
            'id', 'name', 'version', 'description',
            'msrp', 'min_price', 'created_by_user_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by_user_id', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """
        Create a new item.
        Sets created_by_user_id from the request user.
        """
        # Get user ID from request context
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by_user_id'] = request.user.id
        
        return super().create(validated_data)
