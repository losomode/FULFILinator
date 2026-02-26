"""
Order models for FULFILinator.

Orders represent customer orders for items, allocated from Purchase Orders.
Each Order contains line items specifying quantities and pricing.
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from datetime import datetime


class Order(models.Model):
    """
    Order model.
    
    Represents a customer order, typically fulfilled from Purchase Orders.
    Auto-generates unique order numbers in format: ORD-YYYYMMDD-XXXX
    """
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
    ]
    
    order_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        help_text="Auto-generated order number (ORD-YYYYMMDD-XXXX)"
    )
    customer_id = models.CharField(
        max_length=255,
        help_text="ID of customer (from Authinator)"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='OPEN',
        help_text="Order status"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes about this order"
    )
    created_by_user_id = models.CharField(
        max_length=255,
        help_text="ID of user who created this order (from Authinator)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this order was closed"
    )
    closed_by_user_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="ID of user who closed this order"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        indexes = [
            models.Index(fields=['customer_id']),
            models.Index(fields=['status']),
            models.Index(fields=['-created_at']),
        ]
    
    def save(self, *args, **kwargs):
        """
        Override save to auto-generate order number and set closed_at.
        """
        # Auto-generate order number if not set
        if not self.order_number:
            self.order_number = self._generate_order_number()
        
        # Set closed_at when status changes to CLOSED
        if self.status == 'CLOSED' and not self.closed_at:
            self.closed_at = timezone.now()
        
        super().save(*args, **kwargs)
    
    def _generate_order_number(self):
        """
        Generate unique order number in format: ORD-YYYYMMDD-XXXX
        """
        today = datetime.now().strftime('%Y%m%d')
        prefix = f'ORD-{today}-'
        
        # Find the last order number for today
        last_order = Order.objects.filter(
            order_number__startswith=prefix
        ).order_by('order_number').last()
        
        if last_order:
            # Extract sequence number and increment
            last_seq = int(last_order.order_number.split('-')[-1])
            new_seq = last_seq + 1
        else:
            new_seq = 1
        
        return f'{prefix}{new_seq:04d}'
    
    def get_fulfillment_status(self):
        """
        Calculate fulfillment status for this Order.
        
        Returns dict with:
        - line_items: list of dicts with original/delivered/remaining per item
        - deliveries: list of delivery numbers that fulfilled this Order
        - source_pos: list of PO numbers this Order was allocated from
        """
        from django.db.models import Sum
        
        line_items_status = []
        deliveries_dict = {}
        pos_dict = {}
        
        for line_item in self.line_items.select_related('item', 'po_line_item__po').all():
            # Calculate delivered quantity from DeliveryLineItems that reference this Order line item
            delivered_qty = line_item.deliverylineitem_set.aggregate(
                total=Sum('id')  # Count individual delivery line items (one per serial number)
            )['total'] or 0
            # Since each DeliveryLineItem represents one physical item with one serial number,
            # we just count the number of DeliveryLineItems
            delivered_qty = line_item.deliverylineitem_set.count()
            
            waived_qty = line_item.waived_quantity
            remaining_qty = line_item.quantity - delivered_qty - waived_qty
            
            line_items_status.append({
                'line_item_id': line_item.id,
                'item_id': line_item.item.id,
                'item_name': str(line_item.item),
                'original_quantity': line_item.quantity,
                'delivered_quantity': delivered_qty,
                'waived_quantity': waived_qty,
                'remaining_quantity': remaining_qty,
                'price_per_unit': str(line_item.price_per_unit),
            })
            
            # Collect deliveries that reference this line item
            for delivery_line_item in line_item.deliverylineitem_set.select_related('delivery').all():
                delivery = delivery_line_item.delivery
                deliveries_dict[delivery.id] = {
                    'delivery_id': delivery.id,
                    'delivery_number': delivery.delivery_number,
                }
            
            # Collect source PO if this order line item references a PO
            if line_item.po_line_item:
                po = line_item.po_line_item.po
                pos_dict[po.id] = {
                    'po_id': po.id,
                    'po_number': po.po_number,
                }
        
        return {
            'line_items': line_items_status,
            'deliveries': list(deliveries_dict.values()),
            'source_pos': list(pos_dict.values()),
        }
    
    def is_ready_to_close(self) -> bool:
        """
        Check if Order is ready to be closed.
        
        Order is ready when all line items are either:
        - Fully delivered (delivered_qty = original_qty)
        - Fully waived (waived_qty = original_qty)
        - Combination (delivered_qty + waived_qty = original_qty)
        
        Returns:
            True if ready to close, False otherwise
        """
        for line_item in self.line_items.all():
            # Count actual deliveries (each DeliveryLineItem is one physical item)
            delivered_qty = line_item.deliverylineitem_set.count()
            waived_qty = line_item.waived_quantity
            remaining_qty = line_item.quantity - delivered_qty - waived_qty
            
            if remaining_qty > 0:
                return False
        
        return True
    
    def __str__(self):
        """String representation of order."""
        return self.order_number


class OrderLineItem(models.Model):
    """
    Order Line Item model.
    
    Represents a single item type and quantity on an order.
    Can optionally reference a PO line item (for PO-based fulfillment).
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='line_items',
        help_text="Parent order"
    )
    item = models.ForeignKey(
        'items.Item',
        on_delete=models.PROTECT,
        help_text="Item being ordered"
    )
    quantity = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Quantity ordered"
    )
    price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Price per unit (from PO or overridden)"
    )
    waived_quantity = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Quantity waived (not to be delivered)"
    )
    po_line_item = models.ForeignKey(
        'purchase_orders.POLineItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="PO line item this order fulfills from (null for ad-hoc)"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes about this line item"
    )
    override_reason = models.TextField(
        null=True,
        blank=True,
        help_text="Reason if price or quantity was overridden"
    )
    
    class Meta:
        ordering = ['id']
        verbose_name = 'Order Line Item'
        verbose_name_plural = 'Order Line Items'
    
    def __str__(self):
        """String representation of line item."""
        return f"{self.order.order_number} - {self.item.name} x {self.quantity}"
