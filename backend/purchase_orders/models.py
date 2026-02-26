"""
PurchaseOrder models for FULFILinator.

Purchase Orders represent customer commitments for items.
Each PO contains line items specifying quantities and pricing.
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from datetime import datetime


class PurchaseOrder(models.Model):
    """
    Purchase Order model.
    
    Represents a customer's commitment to purchase items.
    Auto-generates unique PO numbers in format: PO-YYYYMMDD-XXXX
    """
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
    ]
    
    po_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        help_text="Auto-generated PO number (PO-YYYYMMDD-XXXX)"
    )
    customer_id = models.CharField(
        max_length=255,
        help_text="ID of customer (from Authinator)"
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date PO was signed/agreed"
    )
    expiration_date = models.DateField(
        null=True,
        blank=True,
        help_text="Target fulfillment deadline"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='OPEN',
        help_text="PO status"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes about this PO"
    )
    google_doc_url = models.URLField(
        null=True,
        blank=True,
        help_text="Google Doc URL reference"
    )
    hubspot_url = models.URLField(
        null=True,
        blank=True,
        help_text="HubSpot URL/ID reference"
    )
    created_by_user_id = models.CharField(
        max_length=255,
        help_text="ID of user who created this PO (from Authinator)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this PO was closed"
    )
    closed_by_user_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="ID of user who closed this PO"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'
    
    def save(self, *args, **kwargs):
        """
        Override save to auto-generate PO number and set closed_at.
        """
        # Auto-generate PO number if not set
        if not self.po_number:
            self.po_number = self._generate_po_number()
        
        # Set closed_at when status changes to CLOSED
        if self.status == 'CLOSED' and not self.closed_at:
            self.closed_at = timezone.now()
        
        super().save(*args, **kwargs)
    
    def _generate_po_number(self):
        """
        Generate unique PO number in format: PO-YYYYMMDD-XXXX
        """
        today = datetime.now().strftime('%Y%m%d')
        prefix = f'PO-{today}-'
        
        # Find the last PO number for today
        last_po = PurchaseOrder.objects.filter(
            po_number__startswith=prefix
        ).order_by('po_number').last()
        
        if last_po:
            # Extract sequence number and increment
            last_seq = int(last_po.po_number.split('-')[-1])
            new_seq = last_seq + 1
        else:
            new_seq = 1
        
        return f'{prefix}{new_seq:04d}'
    
    def __str__(self):
        """String representation of PO."""
        return self.po_number


class POLineItem(models.Model):
    """
    Purchase Order Line Item model.
    
    Represents a single item type and quantity on a PO.
    """
    po = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='line_items',
        help_text="Parent purchase order"
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
        help_text="Negotiated price per unit"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes about this line item"
    )
    
    class Meta:
        ordering = ['id']
        verbose_name = 'PO Line Item'
        verbose_name_plural = 'PO Line Items'
    
    def __str__(self):
        """String representation of line item."""
        return f"{self.po.po_number} - {self.item.name} x {self.quantity}"
