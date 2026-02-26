"""
Serializers for purchase_orders app.
"""
from rest_framework import serializers
from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem


class POLineItemSerializer(serializers.ModelSerializer):
    """Serializer for POLineItem."""
    
    item_name = serializers.SerializerMethodField()
    item_version = serializers.SerializerMethodField()
    admin_override = serializers.BooleanField(write_only=True, required=False, default=False)
    
    class Meta:
        model = POLineItem
        fields = [
            'id',
            'item',
            'item_name',
            'item_version',
            'quantity',
            'price_per_unit',
            'notes',
            'admin_override'
        ]
        read_only_fields = ['id', 'item_name', 'item_version']
    
    def get_item_name(self, obj):
        """Get item name."""
        return obj.item.name
    
    def get_item_version(self, obj):
        """Get item version."""
        return obj.item.version
    
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


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Serializer for PurchaseOrder with nested line items."""
    
    line_items = POLineItemSerializer(many=True, required=False)
    fulfillment_status = serializers.SerializerMethodField()
    created_by_user_id = serializers.CharField(read_only=True)
    
    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'po_number',
            'customer_id',
            'start_date',
            'expiration_date',
            'status',
            'notes',
            'google_doc_url',
            'hubspot_url',
            'created_at',
            'updated_at',
            'created_by_user_id',
            'closed_at',
            'closed_by_user_id',
            'line_items',
            'fulfillment_status'
        ]
        read_only_fields = [
            'id',
            'po_number',
            'created_at',
            'updated_at',
            'created_by_user_id',
            'closed_at',
            'closed_by_user_id',
            'fulfillment_status'
        ]
    
    def get_fulfillment_status(self, obj):
        """
        Calculate fulfillment status for each line item.
        Returns list of dicts with item_id, po_quantity, ordered_quantity, remaining_quantity.
        """
        fulfillment = []
        
        for line_item in obj.line_items.all():
            # For now, ordered_quantity is 0 since orders app not implemented yet
            # TODO: Calculate from orders.models.Order when implemented
            ordered_quantity = 0
            
            fulfillment.append({
                'item_id': line_item.item.id,
                'item_name': line_item.item.name,
                'item_version': line_item.item.version,
                'po_quantity': line_item.quantity,
                'ordered_quantity': ordered_quantity,
                'remaining_quantity': line_item.quantity - ordered_quantity
            })
        
        return fulfillment
    
    def create(self, validated_data):
        """Create PurchaseOrder with nested line items."""
        line_items_data = validated_data.pop('line_items', [])
        
        # Set created_by_user_id from request user
        user = self.context['request'].user
        validated_data['created_by_user_id'] = user.id
        
        purchase_order = PurchaseOrder.objects.create(**validated_data)
        
        # Create line items
        for line_item_data in line_items_data:
            # Remove admin_override flag before creating
            line_item_data.pop('admin_override', None)
            POLineItem.objects.create(po=purchase_order, **line_item_data)
        
        return purchase_order
    
    def update(self, instance, validated_data):
        """Update PurchaseOrder and replace line items."""
        line_items_data = validated_data.pop('line_items', None)
        
        # Update PurchaseOrder fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Replace line items if provided
        if line_items_data is not None:
            # Delete existing line items
            instance.line_items.all().delete()
            
            # Create new line items
            for line_item_data in line_items_data:
                # Remove admin_override flag before creating
                line_item_data.pop('admin_override', None)
                POLineItem.objects.create(po=instance, **line_item_data)
        
        return instance
