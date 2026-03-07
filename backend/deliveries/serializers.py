"""
Serializers for deliveries app.
"""
from rest_framework import serializers
from items.models import Item
from deliveries.models import Delivery, DeliveryLineItem
from core.userinator_client import userinator_client


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
        # Remove serializer-level UniqueValidator for serial_number — the DB unique
        # constraint still enforces it, but this prevents false rejections when
        # updating a delivery (existing serial numbers are still in the DB during
        # validation, before the update() method deletes and re-creates line items).
        extra_kwargs = {
            'serial_number': {'validators': []},
        }
    
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
        Get customer name from USERinator.
        """
        company_data = userinator_client.get_company(obj.customer_id)
        return company_data['name'] if company_data else None
    
    def validate(self, data):
        """Validate delivery data including order quantity limits."""
        from collections import defaultdict
        
        line_items_data = data.get('line_items', [])
        
        # Every delivery line item must be linked to an order
        for li_data in line_items_data:
            if not li_data.get('order_line_item'):
                raise serializers.ValidationError({
                    'line_items': 'Every delivery line item must be linked to an order. '
                                  'Create an ad-hoc order first if needed.'
                })
        
        # Group delivery items by order_line_item to check quantity limits
        order_li_counts = defaultdict(int)
        for li_data in line_items_data:
            order_li_counts[li_data['order_line_item'].id] += 1
        
        if order_li_counts:
            # Exclude current delivery's items when updating
            current_delivery_id = self.instance.id if self.instance else None
            
            for oli_id, new_count in order_li_counts.items():
                oli = None
                # Find the OLI object from the line items data
                for li_data in line_items_data:
                    candidate = li_data.get('order_line_item')
                    if candidate and candidate.id == oli_id:
                        oli = candidate
                        break
                
                if not oli:
                    continue
                
                # Count existing deliveries against this order line item
                existing_qs = DeliveryLineItem.objects.filter(order_line_item_id=oli_id)
                if current_delivery_id:
                    existing_qs = existing_qs.exclude(delivery_id=current_delivery_id)
                existing_count = existing_qs.count()
                
                available = oli.quantity - oli.waived_quantity
                remaining = available - existing_count
                
                if new_count > remaining:
                    raise serializers.ValidationError({
                        'line_items': (
                            f'Cannot deliver {new_count} unit(s) of {oli.item.name} against '
                            f'{oli.order.order_number}. '
                            f'{existing_count} already delivered out of {available} ordered '
                            f'({remaining} remaining). '
                            f'Please create a new order to deliver additional items.'
                        )
                    })
        
        return data
    
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
        from django.db import IntegrityError
        
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
                try:
                    DeliveryLineItem.objects.create(delivery=instance, **line_item_data)
                except IntegrityError:
                    raise serializers.ValidationError({
                        'line_items': f"Duplicate serial number: {line_item_data.get('serial_number', '')}"
                    })
        
        return instance
