"""
Item model for FULFILinator.

Items represent products in the catalog (cameras, nodes, accessories).
Each item has pricing information (MSRP and minimum price).
"""
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Item(models.Model):
    """
    Item model representing products in the catalog.
    
    Items are flat (no hierarchy) - variants are separate items.
    Example: "Camera LR v1.0" and "Camera LR v2.0" are separate items.
    """
    name = models.CharField(
        max_length=255,
        help_text="Product name (e.g., 'Camera LR', 'Node 4.6')"
    )
    version = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Product version (e.g., '1.0', '4.6 GA')"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Product description"
    )
    msrp = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Manufacturer's Suggested Retail Price (list price)"
    )
    min_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Minimum price (reference only, not enforced)"
    )
    created_by_user_id = models.CharField(
        max_length=255,
        help_text="ID of user who created this item (from Authinator)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name', 'version']
        verbose_name = 'Item'
        verbose_name_plural = 'Items'
    
    def __str__(self):
        """String representation of item."""
        if self.version:
            return f"{self.name} (v{self.version})"
        return self.name
