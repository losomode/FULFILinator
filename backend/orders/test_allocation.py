"""
Tests for PO allocation algorithm.
Following TDD - write tests before implementation.

The allocation algorithm should:
1. Allocate from oldest POs first (by start_date)
2. Handle multi-PO allocation if single PO can't fulfill
3. Support ad-hoc orders (no PO reference)
4. Validate quantity availability (with admin override)
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from orders.allocation import POAllocator, AllocationResult
from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem


@pytest.mark.django_db
class TestPOAllocator:
    """Test suite for PO allocation algorithm."""
    
    @pytest.fixture
    def item1(self):
        """Create test item 1."""
        return Item.objects.create(
            name="Camera LR",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def item2(self):
        """Create test item 2."""
        return Item.objects.create(
            name="Node",
            version="4.6",
            msrp=Decimal("499.99"),
            min_price=Decimal("399.99"),
            created_by_user_id="sys-admin-1"
        )
    
    def test_allocate_from_single_po_sufficient_quantity(self, item1):
        """Test allocation when single PO has sufficient quantity."""
        # Create PO with enough quantity
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po_line = POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=5)
        
        assert result.success is True
        assert len(result.allocations) == 1
        assert result.allocations[0]['po_line_item'] == po_line
        assert result.allocations[0]['quantity'] == 5
        assert result.allocations[0]['price_per_unit'] == Decimal("899.99")
        assert result.total_allocated == 5
        assert result.remaining == 0
    
    def test_allocate_from_oldest_po_first(self, item1):
        """Test that allocation prioritizes oldest PO by start_date."""
        # Create older PO
        old_po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today() - timedelta(days=60),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        old_po_line = POLineItem.objects.create(
            po=old_po,
            item=item1,
            quantity=5,
            price_per_unit=Decimal("899.99")
        )
        
        # Create newer PO
        new_po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today() - timedelta(days=30),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=new_po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=3)
        
        # Should allocate from older PO
        assert result.success is True
        assert len(result.allocations) == 1
        assert result.allocations[0]['po_line_item'] == old_po_line
    
    def test_allocate_across_multiple_pos(self, item1):
        """Test allocation spanning multiple POs when single PO insufficient."""
        # Create first PO with partial quantity
        po1 = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today() - timedelta(days=60),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po1_line = POLineItem.objects.create(
            po=po1,
            item=item1,
            quantity=3,
            price_per_unit=Decimal("899.99")
        )
        
        # Create second PO
        po2 = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today() - timedelta(days=30),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po2_line = POLineItem.objects.create(
            po=po2,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=8)
        
        assert result.success is True
        assert len(result.allocations) == 2
        # First allocation from oldest PO (3 units)
        assert result.allocations[0]['po_line_item'] == po1_line
        assert result.allocations[0]['quantity'] == 3
        # Second allocation from newer PO (5 units)
        assert result.allocations[1]['po_line_item'] == po2_line
        assert result.allocations[1]['quantity'] == 5
        assert result.total_allocated == 8
    
    def test_allocate_insufficient_quantity_without_override(self, item1):
        """Test allocation fails when insufficient quantity and no override."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=5,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=10)
        
        assert result.success is False
        assert result.total_allocated == 5
        assert result.remaining == 5
        assert "Insufficient PO quantity" in result.error_message
    
    def test_allocate_insufficient_quantity_with_override(self, item1):
        """Test allocation succeeds with admin override when insufficient quantity."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=5,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=10, allow_override=True)
        
        assert result.success is True
        assert result.total_allocated == 5
        assert result.remaining == 5
        assert result.override_required is True
    
    def test_allocate_no_pos_available(self, item1):
        """Test allocation fails when no POs available."""
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=5)
        
        assert result.success is False
        assert len(result.allocations) == 0
        assert result.total_allocated == 0
        assert "No available POs" in result.error_message
    
    def test_allocate_only_from_customer_pos(self, item1):
        """Test that allocation only considers POs from the same customer."""
        # Create PO for different customer
        other_po = PurchaseOrder.objects.create(
            customer_id="cust-456",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=other_po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=5)
        
        # Should not find any POs for cust-123
        assert result.success is False
        assert len(result.allocations) == 0
    
    def test_allocate_only_from_open_pos(self, item1):
        """Test that allocation only considers OPEN POs."""
        # Create closed PO
        closed_po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            status='CLOSED',
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=closed_po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=5)
        
        # Should not allocate from closed PO
        assert result.success is False
        assert len(result.allocations) == 0
    
    def test_allocate_considers_already_ordered_quantities(self, item1):
        """Test that allocation accounts for quantities already ordered from POs."""
        from orders.models import Order, OrderLineItem
        
        # Create PO with 10 items
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            created_by_user_id="sys-admin-1"
        )
        po_line = POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        # Create existing order that already ordered 6 items
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        OrderLineItem.objects.create(
            order=order,
            item=item1,
            quantity=6,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line
        )
        
        # Try to allocate 5 more items (only 4 available: 10 - 6 = 4)
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=5, allow_override=False)
        
        # Should fail because only 4 available
        assert result.success is False
        assert result.total_allocated == 4
        assert result.remaining == 1
        assert "Insufficient PO quantity" in result.error_message
    
    def test_allocate_multiple_items(self, item1, item2):
        """Test allocating multiple different items at once."""
        # Create PO with both items
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po_line1 = POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        po_line2 = POLineItem.objects.create(
            po=po,
            item=item2,
            quantity=5,
            price_per_unit=Decimal("449.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        
        # Allocate item1
        result1 = allocator.allocate(item1, requested_quantity=3)
        assert result1.success is True
        assert result1.allocations[0]['po_line_item'] == po_line1
        
        # Allocate item2
        result2 = allocator.allocate(item2, requested_quantity=2)
        assert result2.success is True
        assert result2.allocations[0]['po_line_item'] == po_line2
    
    def test_allocation_result_to_dict(self, item1):
        """Test that AllocationResult can be serialized."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po_line = POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        allocator = POAllocator(customer_id="cust-123")
        result = allocator.allocate(item1, requested_quantity=5)
        
        result_dict = result.to_dict()
        assert 'success' in result_dict
        assert 'allocations' in result_dict
        assert 'total_allocated' in result_dict
        assert result_dict['success'] is True
        assert result_dict['total_allocated'] == 5
