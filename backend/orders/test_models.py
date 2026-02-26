"""
Tests for Order models.
Following TDD - write tests before implementation.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError
from orders.models import Order, OrderLineItem
from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem


@pytest.mark.django_db
class TestOrderModel:
    """Test suite for Order model."""
    
    def test_create_order_with_required_fields(self):
        """Test creating an order with required fields."""
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        
        assert order.id is not None
        assert order.order_number is not None  # Auto-generated
        assert order.customer_id == "cust-123"
        assert order.status == 'OPEN'  # Default status
        assert order.created_at is not None
        assert order.created_by_user_id == "sys-admin-1"
    
    def test_order_number_auto_generated(self):
        """Test that order number is auto-generated."""
        order1 = Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        order2 = Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        assert order1.order_number is not None
        assert order2.order_number is not None
        assert order1.order_number != order2.order_number
    
    def test_order_number_format(self):
        """Test that order number follows expected format ORD-YYYYMMDD-XXXX."""
        order = Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        # Should be in format ORD-YYYYMMDD-XXXX
        assert order.order_number.startswith('ORD-')
        assert len(order.order_number) >= 16  # ORD-20260222-0001
    
    def test_order_number_is_unique(self):
        """Test that order numbers are unique."""
        order1 = Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        # Try to create another order with same number (should fail)
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            Order.objects.create(
                customer_id="cust-123",
                created_by_user_id="sys-admin-1",
                order_number=order1.order_number
            )
    
    def test_order_status_choices(self):
        """Test that order status has correct choices."""
        order = Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        # Valid statuses
        order.status = 'OPEN'
        order.save()
        
        order.status = 'CLOSED'
        order.save()
        
        # Invalid status should fail validation
        order.status = 'INVALID'
        with pytest.raises(ValidationError):
            order.full_clean()
    
    def test_order_with_optional_fields(self):
        """Test creating order with all optional fields."""
        order = Order.objects.create(
            customer_id="cust-123",
            notes="Rush order for important customer",
            created_by_user_id="sys-admin-1"
        )
        
        assert order.notes == "Rush order for important customer"
    
    def test_close_order(self):
        """Test closing an order."""
        order = Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        order.status = 'CLOSED'
        order.closed_by_user_id = "sys-admin-2"
        order.save()
        
        order.refresh_from_db()
        assert order.status == 'CLOSED'
        assert order.closed_by_user_id == "sys-admin-2"
        assert order.closed_at is not None
    
    def test_order_string_representation(self):
        """Test order's string representation."""
        order = Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        assert str(order) == order.order_number


@pytest.mark.django_db
class TestOrderLineItemModel:
    """Test suite for OrderLineItem model."""
    
    @pytest.fixture
    def order(self):
        """Create a test order."""
        return Order.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
    
    @pytest.fixture
    def item(self):
        """Create a test item."""
        return Item.objects.create(
            name="Camera LR",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def po_and_line_item(self, item):
        """Create a test PO with line item."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po_line_item = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        return po, po_line_item
    
    def test_create_order_line_item_from_po(self, order, item, po_and_line_item):
        """Test creating an order line item that references a PO line item."""
        po, po_line_item = po_and_line_item
        
        order_line_item = OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=5,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item
        )
        
        assert order_line_item.id is not None
        assert order_line_item.order == order
        assert order_line_item.item == item
        assert order_line_item.quantity == 5
        assert order_line_item.price_per_unit == Decimal("899.99")
        assert order_line_item.po_line_item == po_line_item
    
    def test_create_adhoc_order_line_item(self, order, item):
        """Test creating an ad-hoc order line item (no PO reference)."""
        order_line_item = OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=3,
            price_per_unit=Decimal("950.00"),
            po_line_item=None,  # Ad-hoc
            notes="Special pricing for this order"
        )
        
        assert order_line_item.po_line_item is None
        assert order_line_item.notes == "Special pricing for this order"
    
    def test_order_line_item_quantity_must_be_positive(self, order, item):
        """Test that quantity must be positive."""
        with pytest.raises(ValidationError):
            line_item = OrderLineItem(
                order=order,
                item=item,
                quantity=-5,
                price_per_unit=Decimal("899.99")
            )
            line_item.full_clean()
    
    def test_order_line_item_quantity_must_not_be_zero(self, order, item):
        """Test that quantity cannot be zero."""
        with pytest.raises(ValidationError):
            line_item = OrderLineItem(
                order=order,
                item=item,
                quantity=0,
                price_per_unit=Decimal("899.99")
            )
            line_item.full_clean()
    
    def test_order_line_item_price_must_be_positive(self, order, item):
        """Test that price must be positive."""
        with pytest.raises(ValidationError):
            line_item = OrderLineItem(
                order=order,
                item=item,
                quantity=5,
                price_per_unit=Decimal("-100.00")
            )
            line_item.full_clean()
    
    def test_order_can_have_multiple_line_items(self, order):
        """Test that an order can have multiple line items."""
        item1 = Item.objects.create(
            name="Camera LR",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="sys-admin-1"
        )
        item2 = Item.objects.create(
            name="Node",
            msrp=Decimal("499.99"),
            min_price=Decimal("399.99"),
            created_by_user_id="sys-admin-1"
        )
        
        OrderLineItem.objects.create(order=order, item=item1, quantity=5, price_per_unit=Decimal("899.99"))
        OrderLineItem.objects.create(order=order, item=item2, quantity=10, price_per_unit=Decimal("449.99"))
        
        assert order.line_items.count() == 2
    
    def test_delete_order_deletes_line_items(self, order, item):
        """Test that deleting an order cascades to line items."""
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=5,
            price_per_unit=Decimal("899.99")
        )
        
        order_id = order.id
        order.delete()
        
        # Line items should be deleted too
        assert OrderLineItem.objects.filter(order_id=order_id).count() == 0
    
    def test_delete_item_protected_if_in_order(self, order, item):
        """Test that items cannot be deleted if referenced in orders."""
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=5,
            price_per_unit=Decimal("899.99")
        )
        
        # Should not be able to delete item
        from django.db.models import ProtectedError
        with pytest.raises(ProtectedError):
            item.delete()
    
    def test_order_line_item_with_override_reason(self, order, item):
        """Test order line item with price override and reason."""
        order_line_item = OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=5,
            price_per_unit=Decimal("700.00"),  # Below min_price
            override_reason="Special customer discount approved by VP"
        )
        
        assert order_line_item.override_reason == "Special customer discount approved by VP"
    
    def test_order_line_item_string_representation(self, order, item):
        """Test order line item's string representation."""
        line_item = OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=5,
            price_per_unit=Decimal("899.99")
        )
        
        expected = f"{order.order_number} - {item.name} x 5"
        assert str(line_item) == expected
