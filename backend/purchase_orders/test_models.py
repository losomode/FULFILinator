"""
Tests for PurchaseOrder and POLineItem models.

Following Deft TDD: Tests written BEFORE implementation.
Target: ≥80% coverage
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.core.exceptions import ValidationError
from purchase_orders.models import PurchaseOrder, POLineItem
from items.models import Item


@pytest.mark.django_db
class TestPurchaseOrderModel:
    """Test suite for PurchaseOrder model."""
    
    def test_create_po_with_required_fields(self):
        """Test creating a PO with required fields."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        
        assert po.id is not None
        assert po.po_number is not None  # Auto-generated
        assert po.customer_id == "cust-123"
        assert po.status == 'OPEN'  # Default status
        assert po.created_at is not None
    
    def test_po_number_auto_generated(self):
        """Test that PO number is auto-generated."""
        po1 = PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        po2 = PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        assert po1.po_number is not None
        assert po2.po_number is not None
        assert po1.po_number != po2.po_number
    
    def test_po_number_format(self):
        """Test that PO number follows expected format."""
        po = PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        # Should be in format PO-YYYYMMDD-XXXX
        assert po.po_number.startswith('PO-')
        assert len(po.po_number) >= 15  # PO-20260222-0001
    
    def test_po_number_is_unique(self):
        """Test that PO numbers are unique."""
        po1 = PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        # Try to create another PO with same number (should fail)
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            PurchaseOrder.objects.create(
                customer_id="cust-123",
                created_by_user_id="sys-admin-1",
                po_number=po1.po_number
            )
    
    def test_po_status_choices(self):
        """Test that PO status has correct choices."""
        po = PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        # Valid statuses
        po.status = 'OPEN'
        po.save()
        
        po.status = 'CLOSED'
        po.save()
        
        # Invalid status should fail validation
        po.status = 'INVALID'
        with pytest.raises(ValidationError):
            po.full_clean()
    
    def test_po_with_optional_fields(self):
        """Test creating PO with all optional fields."""
        today = date.today()
        future = today + timedelta(days=90)
        
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=today,
            expiration_date=future,
            notes="Test PO notes",
            google_doc_url="https://docs.google.com/document/d/123",
            hubspot_url="https://hubspot.com/deal/456",
            created_by_user_id="sys-admin-1"
        )
        
        assert po.start_date == today
        assert po.expiration_date == future
        assert po.notes == "Test PO notes"
        assert po.google_doc_url is not None
        assert po.hubspot_url is not None
    
    def test_close_po(self):
        """Test closing a PO."""
        po = PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        po.status = 'CLOSED'
        po.closed_by_user_id = "sys-admin-2"
        po.save()
        
        po.refresh_from_db()
        assert po.status == 'CLOSED'
        assert po.closed_by_user_id == "sys-admin-2"
        assert po.closed_at is not None
    
    def test_po_string_representation(self):
        """Test PO's string representation."""
        po = PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
        
        assert str(po) == po.po_number


@pytest.mark.django_db
class TestPOLineItemModel:
    """Test suite for POLineItem model."""
    
    @pytest.fixture
    def po(self):
        """Create a test PO."""
        return PurchaseOrder.objects.create(customer_id="cust-123", created_by_user_id="sys-admin-1")
    
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
    
    def test_create_po_line_item(self, po, item):
        """Test creating a PO line item."""
        line_item = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        assert line_item.id is not None
        assert line_item.po == po
        assert line_item.item == item
        assert line_item.quantity == 10
        assert line_item.price_per_unit == Decimal("899.99")
    
    def test_po_line_item_quantity_must_be_positive(self, po, item):
        """Test that quantity must be positive."""
        with pytest.raises(ValidationError):
            line_item = POLineItem(
                po=po,
                item=item,
                quantity=-5,
                price_per_unit=Decimal("899.99")
            )
            line_item.full_clean()
    
    def test_po_line_item_quantity_must_not_be_zero(self, po, item):
        """Test that quantity cannot be zero."""
        with pytest.raises(ValidationError):
            line_item = POLineItem(
                po=po,
                item=item,
                quantity=0,
                price_per_unit=Decimal("899.99")
            )
            line_item.full_clean()
    
    def test_po_line_item_price_must_be_positive(self, po, item):
        """Test that price must be positive."""
        with pytest.raises(ValidationError):
            line_item = POLineItem(
                po=po,
                item=item,
                quantity=10,
                price_per_unit=Decimal("-100.00")
            )
            line_item.full_clean()
    
    def test_po_can_have_multiple_line_items(self, po):
        """Test that a PO can have multiple line items."""
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
        
        POLineItem.objects.create(po=po, item=item1, quantity=10, price_per_unit=Decimal("899.99"))
        POLineItem.objects.create(po=po, item=item2, quantity=5, price_per_unit=Decimal("449.99"))
        
        assert po.line_items.count() == 2
    
    def test_delete_po_deletes_line_items(self, po, item):
        """Test that deleting a PO cascades to line items."""
        line_item = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        line_item_id = line_item.id
        
        po.delete()
        
        # Line item should be deleted
        assert not POLineItem.objects.filter(id=line_item_id).exists()
    
    def test_po_line_item_with_notes(self, po, item):
        """Test creating line item with notes."""
        line_item = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99"),
            notes="Special pricing for bulk order"
        )
        
        assert line_item.notes == "Special pricing for bulk order"
    
    def test_po_line_item_string_representation(self, po, item):
        """Test line item's string representation."""
        line_item = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        
        expected = f"{po.po_number} - {item.name} x 10"
        assert str(line_item) == expected
