"""
Serializers for orders app.
"""
from rest_framework import serializers
from items.models import Item
from orders.models import Order, OrderLineItem
from orders.allocation import POAllocator
from core.authinator_client import authinator_client


class OrderLineItemSerializer(serializers.ModelSerializer):
    """Serializer for OrderLineItem."""
    
    item_name = serializers.SerializerMethodField()
    item_version = serializers.SerializerMethodField()
    po_number = serializers.SerializerMethodField()
    admin_override = serializers.BooleanField(write_only=True, required=False, default=False)
    
    class Meta:
        model = OrderLineItem
        fields = [
            'id',
            'item',
            'item_name',
            'item_version',
            'quantity',
            'price_per_unit',
            'po_line_item',
            'po_number',
            'notes',
            'override_reason',
            'admin_override'
        ]
        read_only_fields = ['id', 'item_name', 'item_version', 'po_number', 'po_line_item']
    
    def get_item_name(self, obj):
        """Get item name."""
        return obj.item.name
    
    def get_item_version(self, obj):
        """Get item version."""
        return obj.item.version
    
    def get_po_number(self, obj):
        """Get PO number if this line item references a PO."""
        if obj.po_line_item:
            return obj.po_line_item.po.po_number
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


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for Order with nested line items."""
    
    line_items = OrderLineItemSerializer(many=True, required=False)
    fulfillment_status = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    created_by_user_id = serializers.CharField(read_only=True)
    allocate_from_po = serializers.BooleanField(write_only=True, required=False, default=True)
    
    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'customer_id',
            'customer_name',
            'status',
            'notes',
            'created_at',
            'updated_at',
            'created_by_user_id',
            'closed_at',
            'closed_by_user_id',
            'line_items',
            'fulfillment_status',
            'allocate_from_po'
        ]
        read_only_fields = [
            'id',
            'order_number',
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
        Returns dict with line_items breakdown, deliveries list, and source_pos list.
        """
        return obj.get_fulfillment_status()
    
    def create(self, validated_data):
        """Create Order with nested line items and optional PO allocation."""
        line_items_data = validated_data.pop('line_items', [])
        allocate_from_po = validated_data.pop('allocate_from_po', True)
        
        # Set created_by_user_id from request user
        user = self.context['request'].user
        validated_data['created_by_user_id'] = user.id
        
        order = Order.objects.create(**validated_data)
        
        # Create line items
        for line_item_data in line_items_data:
            admin_override = line_item_data.pop('admin_override', None)
            item = line_item_data['item']
            quantity = line_item_data['quantity']
            
            # Automatic PO allocation if requested
            if allocate_from_po:
                allocator = POAllocator(customer_id=order.customer_id)
                allocation_result = allocator.allocate(
                    item=item,
                    requested_quantity=quantity,
                    allow_override=admin_override
                )
                
                if not allocation_result.success:
                    raise serializers.ValidationError({
                        'line_items': f'Cannot allocate {quantity} units of {item.name}. {allocation_result.error_message}'
                    })
                
                # Create order line items from allocation
                for allocation in allocation_result.allocations:
                    OrderLineItem.objects.create(
                        order=order,
                        item=item,
                        quantity=allocation['quantity'],
                        price_per_unit=allocation['price_per_unit'],
                        po_line_item=allocation['po_line_item'],
                        notes=line_item_data.get('notes', ''),
                        override_reason=line_item_data.get('override_reason', '') if allocation_result.override_required else None
                    )
            else:
                # Ad-hoc order without PO allocation
                OrderLineItem.objects.create(order=order, **line_item_data)
        
        return order
    
    def update(self, instance, validated_data):
        """Update Order and replace line items."""
        line_items_data = validated_data.pop('line_items', None)
        validated_data.pop('allocate_from_po', None)  # Not used in updates
        
        # Update Order fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Replace line items if provided
        if line_items_data is not None:
            # Delete existing line items
            instance.line_items.all().delete()
            
            # Create new line items (without auto-allocation on update)
            for line_item_data in line_items_data:
                line_item_data.pop('admin_override', None)
                OrderLineItem.objects.create(order=instance, **line_item_data)
        
        return instance
