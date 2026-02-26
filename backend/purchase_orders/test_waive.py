"""
Tests for Purchase Order waiving functionality.
Following Deft TDD - write tests before implementation.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from purchase_orders.models import PurchaseOrder, POLineItem
from items.models import Item


@pytest.mark.django_db
class TestPOLineItemWaiving:
    """Test suite for PO line item waiving."""
    
    @pytest.fixture
    def item(self):
        """Create test item."""
        return Item.objects.create(
            name="Camera",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def po_with_line_item(self, item):
        """Create PO with a line item."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        line_item = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        return po, line_item
    
    def test_po_line_item_has_waived_field(self, po_with_line_item):
        """Test that POLineItem has waived_quantity field."""
        po, line_item = po_with_line_item
        
        assert hasattr(line_item, 'waived_quantity')
        assert line_item.waived_quantity == 0  # Default should be 0
    
    def test_waive_entire_remaining_quantity(self, po_with_line_item):
        """Test waiving all remaining quantity on a line item."""
        po, line_item = po_with_line_item
        
        # Waive all 10 units
        line_item.waived_quantity = 10
        line_item.save()
        
        line_item.refresh_from_db()
        assert line_item.waived_quantity == 10
    
    def test_waive_partial_quantity(self, po_with_line_item):
        """Test waiving partial quantity."""
        po, line_item = po_with_line_item
        
        # Waive 3 out of 10 units
        line_item.waived_quantity = 3
        line_item.save()
        
        line_item.refresh_from_db()
        assert line_item.waived_quantity == 3
    
    def test_get_available_quantity_considers_waived(self, po_with_line_item):
        """Test that available quantity calculation considers waived items."""
        from orders.allocation import POAllocator
        
        po, line_item = po_with_line_item
        item = line_item.item
        
        # Initially 10 available
        allocator = POAllocator(customer_id="cust-123")
        assert allocator.get_available_quantity(item) == 10
        
        # Waive 4 units
        line_item.waived_quantity = 4
        line_item.save()
        
        # Should now have 6 available (10 - 4 waived)
        assert allocator.get_available_quantity(item) == 6
    
    def test_cannot_waive_negative_quantity(self, po_with_line_item):
        """Test that waived_quantity cannot be negative."""
        po, line_item = po_with_line_item
        
        from django.core.exceptions import ValidationError
        line_item.waived_quantity = -5
        
        with pytest.raises((ValidationError, Exception)):
            line_item.full_clean()
    
    def test_waived_appears_in_fulfillment_status(self, po_with_line_item):
        """Test that waived quantities appear in fulfillment status."""
        po, line_item = po_with_line_item
        
        # Waive 2 units
        line_item.waived_quantity = 2
        line_item.save()
        
        fulfillment = po.get_fulfillment_status()
        
        assert len(fulfillment['line_items']) == 1
        item_status = fulfillment['line_items'][0]
        
        # Should show waived quantity
        assert 'waived_quantity' in item_status
        assert item_status['waived_quantity'] == 2
        assert item_status['remaining_quantity'] == 8  # 10 - 2 waived


@pytest.mark.django_db
class TestPOReadyToClose:
    """Test suite for PO ready-to-close detection."""
    
    @pytest.fixture
    def item(self):
        return Item.objects.create(
            name="Camera",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="sys-admin-1"
        )
    
    def test_po_not_ready_when_unfulfilled(self, item):
        """Test PO not ready to close when items unfulfilled."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        assert po.is_ready_to_close() is False
    
    def test_po_ready_when_all_fulfilled(self, item):
        """Test PO ready to close when all items ordered."""
        from orders.models import Order, OrderLineItem
        
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            created_by_user_id="sys-admin-1"
        )
        po_line = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        # Create order that fulfills entire PO
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line
        )
        
        assert po.is_ready_to_close() is True
    
    def test_po_ready_when_partially_fulfilled_and_rest_waived(self, item):
        """Test PO ready when partially fulfilled with remaining waived."""
        from orders.models import Order, OrderLineItem
        
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            created_by_user_id="sys-admin-1"
        )
        po_line = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        # Order 6 units
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=6,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line
        )
        
        # Waive remaining 4 units
        po_line.waived_quantity = 4
        po_line.save()
        
        assert po.is_ready_to_close() is True
    
    def test_po_not_ready_when_partially_waived_but_unfulfilled(self, item):
        """Test PO not ready when some waived but others still unfulfilled."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            created_by_user_id="sys-admin-1"
        )
        po_line = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        # Waive only 4 units (6 still unfulfilled)
        po_line.waived_quantity = 4
        po_line.save()
        
        assert po.is_ready_to_close() is False
