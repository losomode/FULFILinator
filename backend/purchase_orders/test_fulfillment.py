"""
Tests for PurchaseOrder and Order fulfillment tracking.

Following Deft TDD: Tests for the fulfillment status methods.
Target: ≥85% coverage
"""
import pytest
from decimal import Decimal
from datetime import date
from purchase_orders.models import PurchaseOrder, POLineItem
from orders.models import Order, OrderLineItem
from deliveries.models import Delivery, DeliveryLineItem
from items.models import Item


@pytest.mark.django_db
class TestPurchaseOrderFulfillment:
    """Test suite for PurchaseOrder fulfillment tracking."""
    
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
            name="Node 4.6",
            version="GA",
            msrp=Decimal("499.99"),
            min_price=Decimal("399.99"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def po_with_items(self, item1, item2):
        """Create PO with line items."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        POLineItem.objects.create(
            po=po,
            item=item2,
            quantity=5,
            price_per_unit=Decimal("449.99")
        )
        return po
    
    def test_get_fulfillment_status_no_orders(self, po_with_items):
        """Test fulfillment status when no orders exist."""
        status = po_with_items.get_fulfillment_status()
        
        assert 'line_items' in status
        assert 'orders' in status
        assert len(status['line_items']) == 2
        assert len(status['orders']) == 0
        
        # Check first line item
        line1 = status['line_items'][0]
        assert line1['original_quantity'] == 10
        assert line1['ordered_quantity'] == 0
        assert line1['remaining_quantity'] == 10
        
        # Check second line item
        line2 = status['line_items'][1]
        assert line2['original_quantity'] == 5
        assert line2['ordered_quantity'] == 0
        assert line2['remaining_quantity'] == 5
    
    def test_get_fulfillment_status_with_partial_order(self, po_with_items, item1):
        """Test fulfillment status with partial order."""
        # Create an order that references the PO
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        
        # Order 3 of the 10 cameras from the PO
        po_line_item = po_with_items.line_items.first()
        OrderLineItem.objects.create(
            order=order,
            item=item1,
            quantity=3,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item
        )
        
        status = po_with_items.get_fulfillment_status()
        
        assert len(status['orders']) == 1
        assert status['orders'][0]['order_id'] == order.id
        assert status['orders'][0]['order_number'] == order.order_number
        
        # Check first line item (cameras)
        line1 = [l for l in status['line_items'] if l['item_name'] == 'Camera LR (v1.0)'][0]
        assert line1['original_quantity'] == 10
        assert line1['ordered_quantity'] == 3
        assert line1['remaining_quantity'] == 7
        
        # Check second line item (nodes) - unchanged
        line2 = [l for l in status['line_items'] if l['item_name'] == 'Node 4.6 (vGA)'][0]
        assert line2['original_quantity'] == 5
        assert line2['ordered_quantity'] == 0
        assert line2['remaining_quantity'] == 5
    
    def test_get_fulfillment_status_fully_ordered(self, po_with_items, item1, item2):
        """Test fulfillment status when PO is fully ordered."""
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        
        # Order all items from PO
        po_line_item1 = po_with_items.line_items.all()[0]
        po_line_item2 = po_with_items.line_items.all()[1]
        
        OrderLineItem.objects.create(
            order=order,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item1
        )
        OrderLineItem.objects.create(
            order=order,
            item=item2,
            quantity=5,
            price_per_unit=Decimal("449.99"),
            po_line_item=po_line_item2
        )
        
        status = po_with_items.get_fulfillment_status()
        
        # All items should show remaining_quantity = 0
        for line_item in status['line_items']:
            assert line_item['remaining_quantity'] == 0
    
    def test_get_fulfillment_status_multiple_orders(self, po_with_items, item1):
        """Test fulfillment status with multiple orders."""
        order1 = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        order2 = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        
        po_line_item = po_with_items.line_items.first()
        
        # Order1: 4 cameras
        OrderLineItem.objects.create(
            order=order1,
            item=item1,
            quantity=4,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item
        )
        
        # Order2: 3 cameras
        OrderLineItem.objects.create(
            order=order2,
            item=item1,
            quantity=3,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item
        )
        
        status = po_with_items.get_fulfillment_status()
        
        assert len(status['orders']) == 2
        order_ids = [o['order_id'] for o in status['orders']]
        assert order1.id in order_ids
        assert order2.id in order_ids
        
        # Check cameras: 7 ordered out of 10
        line1 = [l for l in status['line_items'] if l['item_name'] == 'Camera LR (v1.0)'][0]
        assert line1['ordered_quantity'] == 7
        assert line1['remaining_quantity'] == 3


@pytest.mark.django_db
class TestOrderFulfillment:
    """Test suite for Order fulfillment tracking."""
    
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
            name="Node 4.6",
            version="GA",
            msrp=Decimal("499.99"),
            min_price=Decimal("399.99"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def po_with_items(self, item1, item2):
        """Create PO with line items."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        POLineItem.objects.create(
            po=po,
            item=item2,
            quantity=5,
            price_per_unit=Decimal("449.99")
        )
        return po
    
    @pytest.fixture
    def order_with_items(self, item1, item2, po_with_items):
        """Create order with line items."""
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        
        # Link to PO line items
        po_line_item1 = po_with_items.line_items.all()[0]
        po_line_item2 = po_with_items.line_items.all()[1]
        
        OrderLineItem.objects.create(
            order=order,
            item=item1,
            quantity=10,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item1
        )
        OrderLineItem.objects.create(
            order=order,
            item=item2,
            quantity=5,
            price_per_unit=Decimal("449.99"),
            po_line_item=po_line_item2
        )
        return order
    
    def test_get_fulfillment_status_no_deliveries(self, order_with_items, po_with_items):
        """Test fulfillment status when no deliveries exist."""
        status = order_with_items.get_fulfillment_status()
        
        assert 'line_items' in status
        assert 'deliveries' in status
        assert 'source_pos' in status
        assert len(status['line_items']) == 2
        assert len(status['deliveries']) == 0
        assert len(status['source_pos']) == 1  # One PO
        
        # Check PO reference
        assert status['source_pos'][0]['po_id'] == po_with_items.id
        assert status['source_pos'][0]['po_number'] == po_with_items.po_number
        
        # Check line items
        line1 = status['line_items'][0]
        assert line1['original_quantity'] == 10
        assert line1['delivered_quantity'] == 0
        assert line1['remaining_quantity'] == 10
    
    def test_get_fulfillment_status_with_partial_delivery(self, order_with_items, item1):
        """Test fulfillment status with partial delivery."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="TRACK123",
            created_by_user_id="sys-admin-1"
        )
        
        # Deliver 3 cameras with serial numbers
        order_line_item = order_with_items.line_items.first()
        for i in range(3):
            DeliveryLineItem.objects.create(
                delivery=delivery,
                item=item1,
                serial_number=f"SN-CAM-{i+1:03d}",
                price_per_unit=Decimal("899.99"),
                order_line_item=order_line_item
            )
        
        status = order_with_items.get_fulfillment_status()
        
        assert len(status['deliveries']) == 1
        assert status['deliveries'][0]['delivery_id'] == delivery.id
        
        # Check cameras: 3 delivered out of 10
        line1 = [l for l in status['line_items'] if l['item_name'] == 'Camera LR (v1.0)'][0]
        assert line1['original_quantity'] == 10
        assert line1['delivered_quantity'] == 3
        assert line1['remaining_quantity'] == 7
        
        # Check nodes: unchanged
        line2 = [l for l in status['line_items'] if l['item_name'] == 'Node 4.6 (vGA)'][0]
        assert line2['delivered_quantity'] == 0
        assert line2['remaining_quantity'] == 5
    
    def test_get_fulfillment_status_fully_delivered(self, order_with_items, item1, item2):
        """Test fulfillment status when order is fully delivered."""
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="TRACK123",
            created_by_user_id="sys-admin-1"
        )
        
        order_line_item1 = order_with_items.line_items.all()[0]
        order_line_item2 = order_with_items.line_items.all()[1]
        
        # Deliver all 10 cameras
        for i in range(10):
            DeliveryLineItem.objects.create(
                delivery=delivery,
                item=item1,
                serial_number=f"SN-CAM-{i+1:03d}",
                price_per_unit=Decimal("899.99"),
                order_line_item=order_line_item1
            )
        
        # Deliver all 5 nodes
        for i in range(5):
            DeliveryLineItem.objects.create(
                delivery=delivery,
                item=item2,
                serial_number=f"SN-NODE-{i+1:03d}",
                price_per_unit=Decimal("449.99"),
                order_line_item=order_line_item2
            )
        
        status = order_with_items.get_fulfillment_status()
        
        # All items should show remaining_quantity = 0
        for line_item in status['line_items']:
            assert line_item['remaining_quantity'] == 0
    
    def test_get_fulfillment_status_multiple_deliveries(self, order_with_items, item1):
        """Test fulfillment status with multiple deliveries."""
        delivery1 = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="TRACK123",
            created_by_user_id="sys-admin-1"
        )
        delivery2 = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="TRACK456",
            created_by_user_id="sys-admin-1"
        )
        
        order_line_item = order_with_items.line_items.first()
        
        # Delivery1: 4 cameras
        for i in range(4):
            DeliveryLineItem.objects.create(
                delivery=delivery1,
                item=item1,
                serial_number=f"SN-CAM-A-{i+1:03d}",
                price_per_unit=Decimal("899.99"),
                order_line_item=order_line_item
            )
        
        # Delivery2: 3 cameras
        for i in range(3):
            DeliveryLineItem.objects.create(
                delivery=delivery2,
                item=item1,
                serial_number=f"SN-CAM-B-{i+1:03d}",
                price_per_unit=Decimal("899.99"),
                order_line_item=order_line_item
            )
        
        status = order_with_items.get_fulfillment_status()
        
        assert len(status['deliveries']) == 2
        delivery_ids = [d['delivery_id'] for d in status['deliveries']]
        assert delivery1.id in delivery_ids
        assert delivery2.id in delivery_ids
        
        # Check cameras: 7 delivered out of 10
        line1 = [l for l in status['line_items'] if l['item_name'] == 'Camera LR (v1.0)'][0]
        assert line1['delivered_quantity'] == 7
        assert line1['remaining_quantity'] == 3
    
    def test_get_fulfillment_status_ad_hoc_order_no_po(self, item1):
        """Test fulfillment status for ad-hoc order (no PO reference)."""
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        
        # Create order line item without PO reference
        OrderLineItem.objects.create(
            order=order,
            item=item1,
            quantity=5,
            price_per_unit=Decimal("899.99"),
            po_line_item=None  # No PO
        )
        
        status = order.get_fulfillment_status()
        
        assert len(status['source_pos']) == 0  # No source PO
        assert len(status['line_items']) == 1
        assert status['line_items'][0]['remaining_quantity'] == 5
