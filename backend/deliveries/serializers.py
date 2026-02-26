"""
Serializers for deliveries app.
"""
from rest_framework import serializers
from items.models import Item
from deliveries.models import Delivery, DeliveryLineItem
from core.authinator_client import authinator_client


class DeliveryLineItemSerializer(serializers.ModelSerializer):
    """Serializer for DeliveryLineItem."""
    
    item_name = serializers.SerializerMethodField()
    item_version = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    admin_override = serializers.BooleanField(write_only=True, required=False, default=False)
    
    class Meta:
        model = DeliveryLineItem
        fields = [
            'id',
            'item',
            'item_name',
            'item_version',
            'serial_number',
            'price_per_unit',
            'order_line_item',
            'order_number',
            'notes',
            'override_reason',
            'admin_override'
        ]
        read_only_fields = ['id', 'item_name', 'item_version', 'order_number']
    
    def get_item_name(self, obj):
        """Get item name."""
        return obj.item.name
    
    def get_item_version(self, obj):
        """Get item version."""
        return obj.item.version
    
    def get_order_number(self, obj):
        """Get order number if this line item references an order."""
        if obj.order_line_item:
            return obj.order_line_item.order.order_number
        return None
    
    def validate(self, data):
        """Validate line item data."""
        item = data.get('item')
        price_per_unit = data.get('price_per_unit')
        admin_override = data.get('admin_override', False)
        
        if item and price_per_unit is not None:
            # Check if price is below min_price
            if price_per_unit < item.min_price and not admin_override:
                raise serializers.ValidationError({
                    'price_per_unit': f'Price per unit must be at least {item.min_price}. '
                                     f'Use admin_override=true to bypass this check.'
                })
        
        return data


class DeliverySerializer(serializers.ModelSerializer):
    """Serializer for Delivery with nested line items."""
    
    line_items = DeliveryLineItemSerializer(many=True, required=False)
    customer_name = serializers.SerializerMethodField()
    created_by_user_id = serializers.CharField(read_only=True)
    
    class Meta:
        model = Delivery
        fields = [
            'id',
            'delivery_number',
            'customer_id',
            'customer_name',
            'ship_date',
            'tracking_number',
            'status',
            'notes',
            'created_at',
            'updated_at',
            'created_by_user_id',
            'closed_at',
            'closed_by_user_id',
            'line_items'
        ]
        read_only_fields = [
            'id',
            'delivery_number',
            'created_at',
            'updated_at',
            'created_by_user_id',
            'closed_at',
            'closed_by_user_id'
        ]
    
    def get_customer_name(self, obj):
        """
        Get customer name from AUTHinator.
        """
        customer_data = authinator_client.get_customer(obj.customer_id)
        return customer_data['name'] if customer_data else None
    
    def create(self, validated_data):
        """Create Delivery with nested line items."""
        line_items_data = validated_data.pop('line_items', [])
        
        # Set created_by_user_id from request user
        user = self.context['request'].user
        validated_data['created_by_user_id'] = user.id
        
        delivery = Delivery.objects.create(**validated_data)
        
        # Create line items
        for line_item_data in line_items_data:
            admin_override = line_item_data.pop('admin_override', None)
            
            # Validate serial number uniqueness is handled by database constraint
            DeliveryLineItem.objects.create(delivery=delivery, **line_item_data)
        
        return delivery
    
    def update(self, instance, validated_data):
        """Update Delivery and replace line items."""
        line_items_data = validated_data.pop('line_items', None)
        
        # Update Delivery fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Replace line items if provided
        if line_items_data is not None:
            # Delete existing line items
            instance.line_items.all().delete()
            
            # Create new line items
            for line_item_data in line_items_data:
                line_item_data.pop('admin_override', None)
                DeliveryLineItem.objects.create(delivery=instance, **line_item_data)
        
        return instance
