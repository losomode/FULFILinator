"""
Delivery models for FULFILinator.

Deliveries represent shipments of items to customers with serial number tracking.
Each Delivery contains line items with unique serial numbers.
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from datetime import datetime


class Delivery(models.Model):
    """
    Delivery model.
    
    Represents a shipment of items to a customer.
    Auto-generates unique delivery numbers in format: DEL-YYYYMMDD-XXXX
    """
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
    ]
    
    delivery_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        help_text="Auto-generated delivery number (DEL-YYYYMMDD-XXXX)"
    )
    customer_id = models.CharField(
        max_length=255,
        help_text="ID of customer (from Authinator)"
    )
    ship_date = models.DateField(
        help_text="Date the items were shipped"
    )
    tracking_number = models.CharField(
        max_length=255,
        help_text="Carrier tracking number"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='OPEN',
        help_text="Delivery status"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes about this delivery"
    )
    created_by_user_id = models.CharField(
        max_length=255,
        help_text="ID of user who created this delivery (from Authinator)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this delivery was closed"
    )
    closed_by_user_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="ID of user who closed this delivery"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Delivery'
        verbose_name_plural = 'Deliveries'
    
    def save(self, *args, **kwargs):
        """
        Override save to auto-generate delivery number and set closed_at.
        """
        # Auto-generate delivery number if not set
        if not self.delivery_number:
            self.delivery_number = self._generate_delivery_number()
        
        # Set closed_at when status changes to CLOSED
        if self.status == 'CLOSED' and not self.closed_at:
            self.closed_at = timezone.now()
        
        super().save(*args, **kwargs)
    
    def _generate_delivery_number(self):
        """
        Generate unique delivery number in format: DEL-YYYYMMDD-XXXX
        """
        today = datetime.now().strftime('%Y%m%d')
        prefix = f'DEL-{today}-'
        
        # Find the last delivery number for today
        last_delivery = Delivery.objects.filter(
            delivery_number__startswith=prefix
        ).order_by('delivery_number').last()
        
        if last_delivery:
            # Extract sequence number and increment
            last_seq = int(last_delivery.delivery_number.split('-')[-1])
            new_seq = last_seq + 1
        else:
            new_seq = 1
        
        return f'{prefix}{new_seq:04d}'
    
    def __str__(self):
        """String representation of delivery."""
        return self.delivery_number


class DeliveryLineItem(models.Model):
    """
    Delivery Line Item model.
    
    Represents a single physical item in a delivery.
    Each line item has a unique serial number.
    """
    delivery = models.ForeignKey(
        Delivery,
        on_delete=models.CASCADE,
        related_name='line_items',
        help_text="Parent delivery"
    )
    item = models.ForeignKey(
        'items.Item',
        on_delete=models.PROTECT,
        help_text="Item being delivered"
    )
    serial_number = models.CharField(
        max_length=255,
        unique=True,
        help_text="Unique serial number for this physical item"
    )
    price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Price per unit (from Order or overridden)"
    )
    order_line_item = models.ForeignKey(
        'orders.OrderLineItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Order line item this delivery fulfills"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes about this line item"
    )
    override_reason = models.TextField(
        null=True,
        blank=True,
        help_text="Reason if price was overridden"
    )
    
    class Meta:
        ordering = ['id']
        verbose_name = 'Delivery Line Item'
        verbose_name_plural = 'Delivery Line Items'
        indexes = [
            models.Index(fields=['serial_number']),
        ]
    
    def __str__(self):
        """String representation of line item."""
        return f"{self.delivery.delivery_number} - {self.item.name} ({self.serial_number})"
