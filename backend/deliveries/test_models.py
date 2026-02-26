"""
Tests for Delivery models.
Following TDD - write tests before implementation.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from deliveries.models import Delivery, DeliveryLineItem
from items.models import Item
from orders.models import Order, OrderLineItem


@pytest.mark.django_db
class TestDeliveryModel:
    """Test suite for Delivery model."""
    
    def test_create_delivery_with_required_fields(self):
        """Test creating a delivery with required fields."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS123456789",
            created_by_user_id="sys-admin-1"
        )
        
        assert delivery.id is not None
        assert delivery.delivery_number is not None  # Auto-generated
        assert delivery.customer_id == "cust-123"
        assert delivery.ship_date == date.today()
        assert delivery.tracking_number == "UPS123456789"
        assert delivery.status == 'OPEN'  # Default status
        assert delivery.created_at is not None
    
    def test_delivery_number_auto_generated(self):
        """Test that delivery number is auto-generated."""
        delivery1 = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS111",
            created_by_user_id="sys-admin-1"
        )
        delivery2 = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS222",
            created_by_user_id="sys-admin-1"
        )
        
        assert delivery1.delivery_number is not None
        assert delivery2.delivery_number is not None
        assert delivery1.delivery_number != delivery2.delivery_number
    
    def test_delivery_number_format(self):
        """Test that delivery number follows expected format DEL-YYYYMMDD-XXXX."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS123456789",
            created_by_user_id="sys-admin-1"
        )
        
        # Should be in format DEL-YYYYMMDD-XXXX
        assert delivery.delivery_number.startswith('DEL-')
        assert len(delivery.delivery_number) >= 16  # DEL-20260222-0001
    
    def test_delivery_number_is_unique(self):
        """Test that delivery numbers are unique."""
        delivery1 = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS123",
            created_by_user_id="sys-admin-1"
        )
        
        # Try to create another delivery with same number (should fail)
        with pytest.raises(IntegrityError):
            Delivery.objects.create(
                customer_id="cust-123",
                ship_date=date.today(),
                tracking_number="UPS456",
                delivery_number=delivery1.delivery_number,
                created_by_user_id="sys-admin-1"
            )
    
    def test_delivery_status_choices(self):
        """Test that delivery status has correct choices."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS123",
            created_by_user_id="sys-admin-1"
        )
        
        # Valid statuses
        delivery.status = 'OPEN'
        delivery.save()
        
        delivery.status = 'CLOSED'
        delivery.save()
        
        # Invalid status should fail validation
        delivery.status = 'INVALID'
        with pytest.raises(ValidationError):
            delivery.full_clean()
    
    def test_delivery_with_optional_fields(self):
        """Test creating delivery with all optional fields."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="FEDEX987654321",
            notes="Fragile items, handle with care",
            created_by_user_id="sys-admin-1"
        )
        
        assert delivery.notes == "Fragile items, handle with care"
    
    def test_close_delivery(self):
        """Test closing a delivery."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS123",
            created_by_user_id="sys-admin-1"
        )
        
        delivery.status = 'CLOSED'
        delivery.closed_by_user_id = "sys-admin-2"
        delivery.save()
        
        delivery.refresh_from_db()
        assert delivery.status == 'CLOSED'
        assert delivery.closed_by_user_id == "sys-admin-2"
        assert delivery.closed_at is not None
    
    def test_delivery_string_representation(self):
        """Test delivery's string representation."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS123",
            created_by_user_id="sys-admin-1"
        )
        
        assert str(delivery) == delivery.delivery_number


@pytest.mark.django_db
class TestDeliveryLineItemModel:
    """Test suite for DeliveryLineItem model."""
    
    @pytest.fixture
    def delivery(self):
        """Create a test delivery."""
        return Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS123456789",
            created_by_user_id="sys-admin-1"
        )
    
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
    def order_and_line_item(self, item):
        """Create a test order with line item."""
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        order_line_item = OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        return order, order_line_item
    
    def test_create_delivery_line_item(self, delivery, item, order_and_line_item):
        """Test creating a delivery line item with serial number."""
        order, order_line_item = order_and_line_item
        
        delivery_line_item = DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item,
            serial_number="SN-CAM-001",
            price_per_unit=Decimal("899.99"),
            order_line_item=order_line_item
        )
        
        assert delivery_line_item.id is not None
        assert delivery_line_item.delivery == delivery
        assert delivery_line_item.item == item
        assert delivery_line_item.serial_number == "SN-CAM-001"
        assert delivery_line_item.price_per_unit == Decimal("899.99")
        assert delivery_line_item.order_line_item == order_line_item
    
    def test_serial_number_must_be_unique(self, delivery, item, order_and_line_item):
        """Test that serial numbers must be unique across all deliveries."""
        order, order_line_item = order_and_line_item
        
        # Create first delivery line item
        DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item,
            serial_number="SN-CAM-001",
            price_per_unit=Decimal("899.99"),
            order_line_item=order_line_item
        )
        
        # Try to create another with same serial number (should fail)
        delivery2 = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="UPS999",
            created_by_user_id="sys-admin-1"
        )
        
        with pytest.raises(IntegrityError):
            DeliveryLineItem.objects.create(
                delivery=delivery2,
                item=item,
                serial_number="SN-CAM-001",  # Duplicate
                price_per_unit=Decimal("899.99"),
                order_line_item=order_line_item
            )
    
    def test_delivery_line_item_price_must_be_positive(self, delivery, item, order_and_line_item):
        """Test that price must be positive."""
        order, order_line_item = order_and_line_item
        
        with pytest.raises(ValidationError):
            line_item = DeliveryLineItem(
                delivery=delivery,
                item=item,
                serial_number="SN-CAM-001",
                price_per_unit=Decimal("-100.00"),
                order_line_item=order_line_item
            )
            line_item.full_clean()
    
    def test_delivery_can_have_multiple_line_items(self, delivery, order_and_line_item):
        """Test that a delivery can have multiple line items."""
        order, order_line_item = order_and_line_item
        
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
        
        DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item1,
            serial_number="SN-CAM-001",
            price_per_unit=Decimal("899.99"),
            order_line_item=order_line_item
        )
        DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item2,
            serial_number="SN-NODE-001",
            price_per_unit=Decimal("449.99"),
            order_line_item=order_line_item
        )
        
        assert delivery.line_items.count() == 2
    
    def test_delete_delivery_deletes_line_items(self, delivery, item, order_and_line_item):
        """Test that deleting a delivery cascades to line items."""
        order, order_line_item = order_and_line_item
        
        DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item,
            serial_number="SN-CAM-001",
            price_per_unit=Decimal("899.99"),
            order_line_item=order_line_item
        )
        
        delivery_id = delivery.id
        delivery.delete()
        
        # Line items should be deleted too
        assert DeliveryLineItem.objects.filter(delivery_id=delivery_id).count() == 0
    
    def test_delete_item_protected_if_in_delivery(self, delivery, item, order_and_line_item):
        """Test that items cannot be deleted if referenced in deliveries."""
        order, order_line_item = order_and_line_item
        
        DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item,
            serial_number="SN-CAM-001",
            price_per_unit=Decimal("899.99"),
            order_line_item=order_line_item
        )
        
        # Should not be able to delete item
        from django.db.models import ProtectedError
        with pytest.raises(ProtectedError):
            item.delete()
    
    def test_delivery_line_item_with_override_reason(self, delivery, item, order_and_line_item):
        """Test delivery line item with price override and reason."""
        order, order_line_item = order_and_line_item
        
        delivery_line_item = DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item,
            serial_number="SN-CAM-001",
            price_per_unit=Decimal("700.00"),  # Below min_price
            order_line_item=order_line_item,
            override_reason="Special pricing approved by VP"
        )
        
        assert delivery_line_item.override_reason == "Special pricing approved by VP"
    
    def test_delivery_line_item_string_representation(self, delivery, item, order_and_line_item):
        """Test delivery line item's string representation."""
        order, order_line_item = order_and_line_item
        
        line_item = DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item,
            serial_number="SN-CAM-001",
            price_per_unit=Decimal("899.99"),
            order_line_item=order_line_item
        )
        
        expected = f"{delivery.delivery_number} - {item.name} (SN-CAM-001)"
        assert str(line_item) == expected
    
    def test_query_delivery_by_serial_number(self, delivery, item, order_and_line_item):
        """Test that we can find deliveries by serial number."""
        order, order_line_item = order_and_line_item
        
        DeliveryLineItem.objects.create(
            delivery=delivery,
            item=item,
            serial_number="SN-UNIQUE-12345",
            price_per_unit=Decimal("899.99"),
            order_line_item=order_line_item
        )
        
        # Find by serial number
        line_item = DeliveryLineItem.objects.get(serial_number="SN-UNIQUE-12345")
        assert line_item.delivery == delivery
        assert line_item.item == item
