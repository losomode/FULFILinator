"""
Tests for Item model.

Following Deft TDD: Tests written BEFORE implementation.
Target: ≥80% coverage
"""
import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from items.models import Item


@pytest.mark.django_db
class TestItemModel:
    """Test suite for Item model."""
    
    def test_create_item_with_required_fields(self):
        """Test creating an item with all required fields."""
        item = Item.objects.create(
            name="Camera LR",
            version="1.0",
            description="Long range camera",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="user-123"
        )
        
        assert item.id is not None
        assert item.name == "Camera LR"
        assert item.version == "1.0"
        assert item.msrp == Decimal("999.99")
        assert item.min_price == Decimal("799.99")
        assert item.created_by_user_id == "user-123"
        assert item.created_at is not None
        assert item.updated_at is not None
    
    def test_create_item_without_version(self):
        """Test creating an item without version (should use empty string default)."""
        item = Item.objects.create(
            name="Node",
            description="Processing node",
            msrp=Decimal("499.99"),
            min_price=Decimal("399.99"),
            created_by_user_id="user-123"
        )
        
        assert item.version == ""
    
    def test_create_item_without_description(self):
        """Test creating an item without description (should use empty string default)."""
        item = Item.objects.create(
            name="Accessory",
            msrp=Decimal("49.99"),
            min_price=Decimal("39.99"),
            created_by_user_id="user-123"
        )
        
        assert item.description == ""
    
    def test_item_name_is_required(self):
        """Test that item name is required."""
        with pytest.raises(ValidationError):
            item = Item(
                msrp=Decimal("999.99"),
                min_price=Decimal("799.99"),
                created_by_user_id="user-123"
            )
            item.full_clean()
    
    def test_item_msrp_is_required(self):
        """Test that MSRP is required."""
        with pytest.raises(ValidationError):
            item = Item(
                name="Test Item",
                min_price=Decimal("799.99"),
                created_by_user_id="user-123"
            )
            item.full_clean()
    
    def test_item_min_price_is_required(self):
        """Test that minimum price is required."""
        with pytest.raises(ValidationError):
            item = Item(
                name="Test Item",
                msrp=Decimal("999.99"),
                created_by_user_id="user-123"
            )
            item.full_clean()
    
    def test_msrp_must_be_positive(self):
        """Test that MSRP must be positive."""
        with pytest.raises(ValidationError):
            item = Item(
                name="Test Item",
                msrp=Decimal("-100.00"),
                min_price=Decimal("50.00"),
                created_by_user_id="user-123"
            )
            item.full_clean()
    
    def test_min_price_must_be_positive(self):
        """Test that minimum price must be positive."""
        with pytest.raises(ValidationError):
            item = Item(
                name="Test Item",
                msrp=Decimal("100.00"),
                min_price=Decimal("-50.00"),
                created_by_user_id="user-123"
            )
            item.full_clean()
    
    def test_item_string_representation(self):
        """Test item's string representation."""
        item = Item.objects.create(
            name="Camera LR",
            version="2.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="user-123"
        )
        
        assert str(item) == "Camera LR (v2.0)"
    
    def test_item_string_representation_without_version(self):
        """Test item's string representation without version."""
        item = Item.objects.create(
            name="Node",
            msrp=Decimal("499.99"),
            min_price=Decimal("399.99"),
            created_by_user_id="user-123"
        )
        
        assert str(item) == "Node"
    
    def test_items_ordered_by_name(self):
        """Test that items are ordered by name by default."""
        Item.objects.create(
            name="Zebra Item",
            msrp=Decimal("100.00"),
            min_price=Decimal("80.00"),
            created_by_user_id="user-123"
        )
        Item.objects.create(
            name="Alpha Item",
            msrp=Decimal("100.00"),
            min_price=Decimal("80.00"),
            created_by_user_id="user-123"
        )
        
        items = list(Item.objects.all())
        assert items[0].name == "Alpha Item"
        assert items[1].name == "Zebra Item"
    
    def test_item_timestamps_auto_set(self):
        """Test that created_at and updated_at are automatically set."""
        item = Item.objects.create(
            name="Test Item",
            msrp=Decimal("100.00"),
            min_price=Decimal("80.00"),
            created_by_user_id="user-123"
        )
        
        assert item.created_at is not None
        assert item.updated_at is not None
        
        # Update and check that updated_at changes
        original_updated = item.updated_at
        item.name = "Updated Item"
        item.save()
        
        assert item.updated_at > original_updated
