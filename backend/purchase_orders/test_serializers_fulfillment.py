"""
Tests for PurchaseOrder and Order serializer fulfillment status.

Following Deft TDD: Tests for serializer methods.
Target: ≥85% coverage
"""
import pytest
from decimal import Decimal
from datetime import date
from rest_framework.test import APIRequestFactory
from purchase_orders.models import PurchaseOrder, POLineItem
from purchase_orders.serializers import PurchaseOrderSerializer
from orders.models import Order, OrderLineItem
from orders.serializers import OrderSerializer
from deliveries.models import Delivery, DeliveryLineItem
from items.models import Item
from core.authentication import AuthinatorUser


@pytest.mark.django_db
class TestPurchaseOrderSerializerFulfillment:
    """Test suite for PurchaseOrderSerializer fulfillment status."""
    
    @pytest.fixture
    def user(self):
        """Create test user."""
        return AuthinatorUser({
            'id': "test-user-1",
            'username': "testuser",
            'email': "test@example.com",
            'role': "SYSTEM_ADMIN",
            'customer_id': "cust-123",
            'is_verified': True,
            'is_active': True
        })
    
    @pytest.fixture
    def factory(self):
        """Create API request factory."""
        return APIRequestFactory()
    
    @pytest.fixture
    def item(self):
        """Create test item."""
        return Item.objects.create(
            name="Camera LR",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def po_with_items(self, item):
        """Create PO with line items."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        return po
    
    def test_serializer_includes_fulfillment_status(self, po_with_items, user, factory):
        """Test that serializer includes fulfillment status field."""
        request = factory.get('/api/pos/')
        request.user = user
        
        serializer = PurchaseOrderSerializer(
            po_with_items,
            context={'request': request}
        )
        data = serializer.data
        
        assert 'fulfillment_status' in data
        assert 'line_items' in data['fulfillment_status']
        assert 'orders' in data['fulfillment_status']
    
    def test_serializer_fulfillment_with_no_orders(self, po_with_items, user, factory):
        """Test fulfillment status when no orders exist."""
        request = factory.get('/api/pos/')
        request.user = user
        
        serializer = PurchaseOrderSerializer(
            po_with_items,
            context={'request': request}
        )
        data = serializer.data
        
        fulfillment = data['fulfillment_status']
        assert len(fulfillment['line_items']) == 1
        assert len(fulfillment['orders']) == 0
        
        line_item = fulfillment['line_items'][0]
        assert line_item['original_quantity'] == 10
        assert line_item['ordered_quantity'] == 0
        assert line_item['remaining_quantity'] == 10
    
    def test_serializer_fulfillment_with_order(self, po_with_items, item, user, factory):
        """Test fulfillment status with an order."""
        # Create order that references the PO
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        po_line_item = po_with_items.line_items.first()
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=3,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item
        )
        
        request = factory.get('/api/pos/')
        request.user = user
        
        serializer = PurchaseOrderSerializer(
            po_with_items,
            context={'request': request}
        )
        data = serializer.data
        
        fulfillment = data['fulfillment_status']
        assert len(fulfillment['orders']) == 1
        assert fulfillment['orders'][0]['order_id'] == order.id
        assert fulfillment['orders'][0]['order_number'] == order.order_number
        
        line_item = fulfillment['line_items'][0]
        assert line_item['ordered_quantity'] == 3
        assert line_item['remaining_quantity'] == 7


@pytest.mark.django_db
class TestOrderSerializerFulfillment:
    """Test suite for OrderSerializer fulfillment status."""
    
    @pytest.fixture
    def user(self):
        """Create test user."""
        return AuthinatorUser({
            'id': "test-user-1",
            'username': "testuser",
            'email': "test@example.com",
            'role': "SYSTEM_ADMIN",
            'customer_id': "cust-123",
            'is_verified': True,
            'is_active': True
        })
    
    @pytest.fixture
    def factory(self):
        """Create API request factory."""
        return APIRequestFactory()
    
    @pytest.fixture
    def item(self):
        """Create test item."""
        return Item.objects.create(
            name="Camera LR",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def po_with_items(self, item):
        """Create PO with line items."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99")
        )
        return po
    
    @pytest.fixture
    def order_with_items(self, item, po_with_items):
        """Create order with line items."""
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        po_line_item = po_with_items.line_items.first()
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=10,
            price_per_unit=Decimal("899.99"),
            po_line_item=po_line_item
        )
        return order
    
    def test_serializer_includes_fulfillment_status(self, order_with_items, user, factory):
        """Test that serializer includes fulfillment status field."""
        request = factory.get('/api/orders/')
        request.user = user
        
        serializer = OrderSerializer(
            order_with_items,
            context={'request': request}
        )
        data = serializer.data
        
        assert 'fulfillment_status' in data
        assert 'line_items' in data['fulfillment_status']
        assert 'deliveries' in data['fulfillment_status']
        assert 'source_pos' in data['fulfillment_status']
    
    def test_serializer_fulfillment_with_no_deliveries(self, order_with_items, po_with_items, user, factory):
        """Test fulfillment status when no deliveries exist."""
        request = factory.get('/api/orders/')
        request.user = user
        
        serializer = OrderSerializer(
            order_with_items,
            context={'request': request}
        )
        data = serializer.data
        
        fulfillment = data['fulfillment_status']
        assert len(fulfillment['line_items']) == 1
        assert len(fulfillment['deliveries']) == 0
        assert len(fulfillment['source_pos']) == 1
        
        # Check PO reference
        assert fulfillment['source_pos'][0]['po_id'] == po_with_items.id
        assert fulfillment['source_pos'][0]['po_number'] == po_with_items.po_number
        
        line_item = fulfillment['line_items'][0]
        assert line_item['original_quantity'] == 10
        assert line_item['delivered_quantity'] == 0
        assert line_item['remaining_quantity'] == 10
    
    def test_serializer_fulfillment_with_delivery(self, order_with_items, item, user, factory):
        """Test fulfillment status with a delivery."""
        # Create delivery
        delivery = Delivery.objects.create(
            customer_id="cust-123",
            ship_date=date.today(),
            tracking_number="TRACK123",
            created_by_user_id="sys-admin-1"
        )
        
        # Deliver 3 items with serial numbers
        order_line_item = order_with_items.line_items.first()
        for i in range(3):
            DeliveryLineItem.objects.create(
                delivery=delivery,
                item=item,
                serial_number=f"SN-CAM-{i+1:03d}",
                price_per_unit=Decimal("899.99"),
                order_line_item=order_line_item
            )
        
        request = factory.get('/api/orders/')
        request.user = user
        
        serializer = OrderSerializer(
            order_with_items,
            context={'request': request}
        )
        data = serializer.data
        
        fulfillment = data['fulfillment_status']
        assert len(fulfillment['deliveries']) == 1
        assert fulfillment['deliveries'][0]['delivery_id'] == delivery.id
        assert fulfillment['deliveries'][0]['delivery_number'] == delivery.delivery_number
        
        line_item = fulfillment['line_items'][0]
        assert line_item['delivered_quantity'] == 3
        assert line_item['remaining_quantity'] == 7
    
    def test_serializer_fulfillment_ad_hoc_order(self, item, user, factory):
        """Test fulfillment status for ad-hoc order (no PO)."""
        order = Order.objects.create(
            customer_id="cust-123",
            created_by_user_id="sys-admin-1"
        )
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=5,
            price_per_unit=Decimal("899.99"),
            po_line_item=None  # No PO
        )
        
        request = factory.get('/api/orders/')
        request.user = user
        
        serializer = OrderSerializer(
            order,
            context={'request': request}
        )
        data = serializer.data
        
        fulfillment = data['fulfillment_status']
        assert len(fulfillment['source_pos']) == 0  # No source PO
        assert len(fulfillment['line_items']) == 1
        assert fulfillment['line_items'][0]['remaining_quantity'] == 5
