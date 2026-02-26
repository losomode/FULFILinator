"""
Serializers for purchase_orders app.
"""
from rest_framework import serializers
from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem
from core.authinator_client import authinator_client


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
    customer_name = serializers.SerializerMethodField()
    created_by_user_id = serializers.CharField(read_only=True)
    
    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'po_number',
            'customer_id',
            'customer_name',
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
    
    def get_customer_name(self, obj):
        """
        Get customer name from AUTHinator.
        """
        customer_data = authinator_client.get_customer(obj.customer_id)
        return customer_data['name'] if customer_data else None
    
    def get_fulfillment_status(self, obj):
        """
        Get fulfillment status from model method.
        Returns dict with line_items breakdown and list of orders.
        """
        return obj.get_fulfillment_status()
    
    def validate(self, data):
        """
        Validate PurchaseOrder data.
        """
        start_date = data.get('start_date')
        expiration_date = data.get('expiration_date')
        
        # If both dates provided, validate expiration is after start
        if start_date and expiration_date:
            if expiration_date < start_date:
                raise serializers.ValidationError({
                    'expiration_date': 'Expiration date must be after start date.'
                })
        
        return data
    
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
