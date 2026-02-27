"""
Tests for dashboard views.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from rest_framework.test import APIClient

from purchase_orders.models import PurchaseOrder, POLineItem
from orders.models import Order, OrderLineItem
from deliveries.models import Delivery, DeliveryLineItem
from items.models import Item
from core.authentication import AuthinatorUser


@pytest.mark.django_db
class TestDashboardMetrics:
    """Test suite for dashboard metrics endpoint."""
    
    @pytest.fixture
    def system_admin(self):
        """Create system admin user."""
        return AuthinatorUser({
            'id': 'sys-admin-1',
            'username': 'admin',
            'email': 'admin@example.com',
            'role': 'ADMIN',
            'is_verified': True,
            'is_active': True,
        })
    
    @pytest.fixture
    def customer_user(self):
        """Create customer user."""
        return AuthinatorUser({
            'id': 'cust-user-1',
            'username': 'customer',
            'email': 'customer@example.com',
            'role': 'USER',
            'customer_id': 'CUST-123',
            'is_verified': True,
            'is_active': True,
        })
    
    @pytest.fixture
    def item(self):
        """Create test item."""
        return Item.objects.create(
            name="Test Item",
            version="1.0",
            msrp=Decimal("100.00"),
            min_price=Decimal("80.00"),
            created_by_user_id="sys-admin-1"
        )
    
    @pytest.fixture
    def sample_data(self, item):
        """Create sample POs, Orders, Deliveries."""
        # PO 1: Open, expiring soon
        po1 = PurchaseOrder.objects.create(
            customer_id="CUST-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=15),
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(po=po1, item=item, quantity=10, price_per_unit=Decimal("90.00"))
        
        # PO 2: Closed
        po2 = PurchaseOrder.objects.create(
            customer_id="CUST-123",
            start_date=date.today() - timedelta(days=30),
            expiration_date=date.today() + timedelta(days=60),
            status='CLOSED',
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(po=po2, item=item, quantity=5, price_per_unit=Decimal("90.00"))
        
        # PO 3: Open, different customer
        po3 = PurchaseOrder.objects.create(
            customer_id="CUST-456",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=90),
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(po=po3, item=item, quantity=20, price_per_unit=Decimal("90.00"))
        
        # Order 1: Open
        order1 = Order.objects.create(
            customer_id="CUST-123",
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        OrderLineItem.objects.create(order=order1, item=item, quantity=5, price_per_unit=Decimal("90.00"))
        
        # Order 2: Closed
        order2 = Order.objects.create(
            customer_id="CUST-123",
            status='CLOSED',
            created_by_user_id="sys-admin-1"
        )
        
        # Delivery 1: Closed this month
        delivery1 = Delivery.objects.create(
            customer_id="CUST-123",
            ship_date=date.today(),
            tracking_number="TRACK123",
            status='CLOSED',
            created_by_user_id="sys-admin-1"
        )
        
        return {'po1': po1, 'po2': po2, 'po3': po3, 'order1': order1, 'order2': order2, 'delivery1': delivery1}
    
    def test_metrics_for_system_admin(self, system_admin, sample_data):
        """System admin sees all metrics across all customers."""
        client = APIClient()
        client.force_authenticate(user=system_admin)
        
        response = client.get('/api/fulfil/dashboard/metrics/')
        
        assert response.status_code == 200
        data = response.json()
        
        # PO metrics
        assert data['purchase_orders']['open'] == 2  # po1, po3
        assert data['purchase_orders']['closed'] == 1  # po2
        assert data['purchase_orders']['total'] == 3
        assert data['purchase_orders']['expiring_soon'] == 1  # po1 expires in 15 days
        
        # Order metrics
        assert data['orders']['open'] == 1
        assert data['orders']['closed'] == 1
        assert data['orders']['total'] == 2
        
        # Delivery metrics
        assert data['deliveries']['closed_this_month'] == 1
        
        # Customer count
        assert data['customers']['count'] == 2  # CUST-123, CUST-456
    
    def test_metrics_for_customer_user(self, customer_user, sample_data):
        """Customer user sees only their own metrics."""
        client = APIClient()
        client.force_authenticate(user=customer_user)
        
        response = client.get('/api/fulfil/dashboard/metrics/')
        
        assert response.status_code == 200
        data = response.json()
        
        # PO metrics - only CUST-123
        assert data['purchase_orders']['open'] == 1  # po1 only
        assert data['purchase_orders']['closed'] == 1  # po2 only
        assert data['purchase_orders']['total'] == 2
        assert data['purchase_orders']['expiring_soon'] == 1
        
        # Order metrics
        assert data['orders']['open'] == 1
        assert data['orders']['closed'] == 1
        
        # Customer count
        assert data['customers']['count'] == 1
    
    def test_fulfillment_rates(self, system_admin, sample_data):
        """Test fulfillment rate calculations."""
        client = APIClient()
        client.force_authenticate(user=system_admin)
        
        response = client.get('/api/fulfil/dashboard/metrics/')
        data = response.json()
        
        # 1 closed out of 3 total POs = 33.3%
        assert data['purchase_orders']['fulfillment_rate'] == pytest.approx(33.3, 0.1)
        
        # 1 closed out of 2 total orders = 50%
        assert data['orders']['fulfillment_rate'] == 50.0


@pytest.mark.django_db
class TestDashboardAlerts:
    """Test suite for dashboard alerts endpoint."""
    
    @pytest.fixture
    def system_admin(self):
        return AuthinatorUser({
            'id': 'sys-admin-1',
            'username': 'admin',
            'email': 'admin@example.com',
            'role': 'ADMIN',
            'is_verified': True,
            'is_active': True,
        })
    
    @pytest.fixture
    def customer_user(self):
        return AuthinatorUser({
            'id': 'cust-user-1',
            'username': 'customer',
            'email': 'customer@example.com',
            'role': 'USER',
            'customer_id': 'CUST-123',
            'is_verified': True,
            'is_active': True,
        })
    
    @pytest.fixture
    def item(self):
        return Item.objects.create(
            name="Test Item",
            version="1.0",
            msrp=Decimal("100.00"),
            min_price=Decimal("80.00"),
            created_by_user_id="sys-admin-1"
        )
    
    def test_expiring_soon_alert(self, system_admin, item):
        """Test PO expiring soon alert."""
        po = PurchaseOrder.objects.create(
            customer_id="CUST-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=10),
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(po=po, item=item, quantity=10, price_per_unit=Decimal("90.00"))
        
        client = APIClient()
        client.force_authenticate(user=system_admin)
        
        response = client.get('/api/fulfil/dashboard/alerts/')
        
        assert response.status_code == 200
        data = response.json()
        
        expiring_alerts = [a for a in data['alerts'] if a['type'] == 'po_expiring_soon']
        assert len(expiring_alerts) == 1
        alert = expiring_alerts[0]
        assert alert['entity_number'] == po.po_number
        assert alert['days_until_expiration'] == 10
        assert alert['severity'] == 'warning'
    
    def test_ready_to_close_alerts(self, system_admin, item):
        """Test ready to close alerts for PO and Order."""
        # Create PO with fully waived line items (ready to close)
        po = PurchaseOrder.objects.create(
            customer_id="CUST-123",
            start_date=date.today(),
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        po_line = POLineItem.objects.create(po=po, item=item, quantity=10, price_per_unit=Decimal("90.00"))
        po_line.waived_quantity = 10
        po_line.save()
        
        # Create Order with fully waived line items (ready to close)
        order = Order.objects.create(
            customer_id="CUST-123",
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        order_line = OrderLineItem.objects.create(order=order, item=item, quantity=5, price_per_unit=Decimal("90.00"))
        order_line.waived_quantity = 5
        order_line.save()
        
        client = APIClient()
        client.force_authenticate(user=system_admin)
        
        response = client.get('/api/fulfil/dashboard/alerts/')
        data = response.json()
        
        po_alerts = [a for a in data['alerts'] if a['type'] == 'po_ready_to_close']
        assert len(po_alerts) == 1
        assert po_alerts[0]['entity_number'] == po.po_number
        
        order_alerts = [a for a in data['alerts'] if a['type'] == 'order_ready_to_close']
        assert len(order_alerts) == 1
        assert order_alerts[0]['entity_number'] == order.order_number
    
    def test_customer_isolation_in_alerts(self, customer_user, item):
        """Customer users only see alerts for their customer."""
        # Create PO for CUST-123 (customer's PO)
        po1 = PurchaseOrder.objects.create(
            customer_id="CUST-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=10),
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(po=po1, item=item, quantity=10, price_per_unit=Decimal("90.00"))
        
        # Create PO for different customer
        po2 = PurchaseOrder.objects.create(
            customer_id="CUST-456",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=10),
            status='OPEN',
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(po=po2, item=item, quantity=10, price_per_unit=Decimal("90.00"))
        
        client = APIClient()
        client.force_authenticate(user=customer_user)
        
        response = client.get('/api/fulfil/dashboard/alerts/')
        data = response.json()
        
        # Should only see alert for po1 (CUST-123), not po2
        assert len(data['alerts']) == 1
        assert data['alerts'][0]['customer_id'] == 'CUST-123'
