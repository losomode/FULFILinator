"""
PO Allocation Algorithm for FULFILinator.

Allocates order quantities from Purchase Orders using oldest-first strategy.
"""
from typing import List, Dict, Optional
from decimal import Decimal
from purchase_orders.models import PurchaseOrder, POLineItem
from items.models import Item


class AllocationResult:
    """
    Result of a PO allocation attempt.
    
    Contains information about allocated quantities, source POs,
    and any errors or overrides required.
    """
    
    def __init__(self):
        self.success = False
        self.allocations = []  # List of dicts with po_line_item, quantity, price_per_unit
        self.total_allocated = 0
        self.remaining = 0
        self.error_message = ""
        self.override_required = False
    
    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'success': self.success,
            'allocations': [
                {
                    'po_line_item_id': a['po_line_item'].id,
                    'po_number': a['po_line_item'].po.po_number,
                    'quantity': a['quantity'],
                    'price_per_unit': str(a['price_per_unit']),
                }
                for a in self.allocations
            ],
            'total_allocated': self.total_allocated,
            'remaining': self.remaining,
            'error_message': self.error_message,
            'override_required': self.override_required,
        }


class POAllocator:
    """
    Allocates order quantities from available Purchase Orders.
    
    Uses oldest-first strategy based on PO start_date.
    """
    
    def __init__(self, customer_id: str):
        """
        Initialize allocator for a specific customer.
        
        Args:
            customer_id: Customer ID to allocate POs from
        """
        self.customer_id = customer_id
    
    def allocate(
        self,
        item: Item,
        requested_quantity: int,
        allow_override: bool = False
    ) -> AllocationResult:
        """
        Allocate requested quantity of an item from available POs.
        
        Algorithm:
        1. Find all open POs for this customer with this item
        2. Order by start_date (oldest first)
        3. Allocate from each PO until requested quantity fulfilled
        4. If insufficient quantity and no override, fail
        5. If insufficient quantity with override, succeed but mark as override
        
        Args:
            item: Item to allocate
            requested_quantity: Quantity requested
            allow_override: Allow allocation even if insufficient PO quantity
        
        Returns:
            AllocationResult with allocation details
        """
        result = AllocationResult()
        result.remaining = requested_quantity
        
        # Find available PO line items for this customer and item
        # Only consider OPEN POs, ordered by start_date (oldest first)
        available_po_lines = POLineItem.objects.filter(
            po__customer_id=self.customer_id,
            po__status='OPEN',
            item=item
        ).select_related('po', 'item').order_by('po__start_date', 'po__id')
        
        if not available_po_lines.exists():
            result.success = False
            result.error_message = f"No available POs found for customer {self.customer_id} and item {item.name}"
            return result
        
        # Allocate from each PO line item until we have enough
        for po_line in available_po_lines:
            if result.remaining == 0:
                break
            
            # Calculate available quantity = PO quantity - already ordered quantity - waived quantity
            from django.db.models import Sum
            ordered_qty = po_line.orderlineitem_set.aggregate(
                total=Sum('quantity')
            )['total'] or 0
            waived_qty = po_line.waived_quantity
            available_qty = po_line.quantity - ordered_qty - waived_qty
            
            # Skip if no quantity available from this PO line
            if available_qty <= 0:
                continue
            
            # Determine how much to allocate from this PO line
            qty_to_allocate = min(available_qty, result.remaining)
            
            if qty_to_allocate > 0:
                result.allocations.append({
                    'po_line_item': po_line,
                    'quantity': qty_to_allocate,
                    'price_per_unit': po_line.price_per_unit
                })
                result.total_allocated += qty_to_allocate
                result.remaining -= qty_to_allocate
        
        # Check if we fulfilled the request
        if result.remaining == 0:
            result.success = True
        elif allow_override:
            # Admin override: allow partial fulfillment
            result.success = True
            result.override_required = True
        else:
            result.success = False
            result.error_message = (
                f"Insufficient PO quantity available. "
                f"Requested: {requested_quantity}, "
                f"Available: {result.total_allocated}, "
                f"Shortage: {result.remaining}"
            )
        
        return result
    
    def get_available_quantity(self, item: Item) -> int:
        """
        Get total available quantity for an item across all POs.
        
        Args:
            item: Item to check
        
        Returns:
            Total available quantity (PO quantity - already ordered)
        """
        from django.db.models import Sum
        
        po_lines = POLineItem.objects.filter(
            po__customer_id=self.customer_id,
            po__status='OPEN',
            item=item
        )
        
        total = 0
        for po_line in po_lines:
            ordered_qty = po_line.orderlineitem_set.aggregate(
                total=Sum('quantity')
            )['total'] or 0
            waived_qty = po_line.waived_quantity
            available = po_line.quantity - ordered_qty - waived_qty
            if available > 0:
                total += available
        
        return total
