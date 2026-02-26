"""
Tests for email notification utilities.
"""
from django.test import TestCase
from django.core import mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch, MagicMock

from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem
from orders.models import Order, OrderLineItem
from deliveries.models import Delivery, DeliveryLineItem
from notifications.utils import (
    get_admin_emails,
    get_customer_email,
    send_delivery_shipped_email,
    send_po_expiring_soon_email,
    send_po_ready_to_close_email,
    send_order_ready_to_close_email,
    check_expiring_pos
)


class TestGetAdminEmails(TestCase):
    """Test get_admin_emails function."""
    
    def test_get_admin_emails_from_settings(self):
        """Test that admin emails are retrieved from settings."""
        # Mock settings using patch.dict
        with patch('notifications.utils.settings') as mock_settings:
            mock_settings.ADMIN_NOTIFICATION_EMAILS = ['admin1@test.com', 'admin2@test.com']
            emails = get_admin_emails()
            self.assertEqual(emails, ['admin1@test.com', 'admin2@test.com'])
    
    def test_get_admin_emails_empty(self):
        """Test that empty list is returned when no admin emails configured."""
        with patch('notifications.utils.settings') as mock_settings:
            mock_settings.ADMIN_NOTIFICATION_EMAILS = []
            emails = get_admin_emails()
            self.assertEqual(emails, [])


class TestGetCustomerEmail(TestCase):
    """Test get_customer_email function."""
    
    @patch('notifications.utils.authinator_client.get_customer')
    def test_get_customer_email_success(self, mock_get_customer):
        """Test successful retrieval of customer email."""
        mock_get_customer.return_value = {
            'id': 'cust-123',
            'name': 'Test Customer',
            'contact_email': 'customer@test.com'
        }
        
        email = get_customer_email('cust-123')
        self.assertEqual(email, 'customer@test.com')
        mock_get_customer.assert_called_once_with('cust-123')
    
    @patch('notifications.utils.authinator_client.get_customer')
    def test_get_customer_email_fallback_to_email(self, mock_get_customer):
        """Test fallback to 'email' field if 'contact_email' not present."""
        mock_get_customer.return_value = {
            'id': 'cust-123',
            'name': 'Test Customer',
            'email': 'fallback@test.com'
        }
        
        email = get_customer_email('cust-123')
        self.assertEqual(email, 'fallback@test.com')
    
    @patch('notifications.utils.authinator_client.get_customer')
    def test_get_customer_email_not_found(self, mock_get_customer):
        """Test that None is returned when customer not found."""
        mock_get_customer.return_value = None
        
        email = get_customer_email('cust-123')
        self.assertIsNone(email)
    
    def test_get_customer_email_empty_id(self):
        """Test that None is returned for empty customer ID."""
        email = get_customer_email('')
        self.assertIsNone(email)
        
        email = get_customer_email(None)
        self.assertIsNone(email)


class TestDeliveryShippedEmail(TestCase):
    """Test send_delivery_shipped_email function."""
    
    def setUp(self):
        """Set up test data."""
        self.item = Item.objects.create(
            name='Test Item',
            msrp=100.00,
            min_price=80.00,
            created_by_user_id='test-user'
        )
        
        self.delivery = Delivery.objects.create(
            delivery_number='DEL-001',
            customer_id='cust-123',
            ship_date=timezone.now().date(),
            tracking_number='TRACK123',
            status='CLOSED'
        )
        
        self.line_item1 = DeliveryLineItem.objects.create(
            delivery=self.delivery,
            item=self.item,
            serial_number='SN001',
            price_per_unit=100.00
        )
        self.line_item2 = DeliveryLineItem.objects.create(
            delivery=self.delivery,
            item=self.item,
            serial_number='SN002',
            price_per_unit=100.00
        )
    
    @patch('notifications.utils.get_customer_email')
    def test_send_delivery_shipped_email_success(self, mock_get_email):
        """Test successful delivery shipped email."""
        mock_get_email.return_value = 'customer@test.com'
        
        result = send_delivery_shipped_email(self.delivery)
        
        self.assertTrue(result)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'Delivery Shipped: #DEL-001')
        self.assertEqual(email.to, ['customer@test.com'])
        self.assertIn('DEL-001', email.body)
        self.assertIn('TRACK123', email.body)
        self.assertIn('Test Item', email.body)
        self.assertIn('SN001', email.body)
        self.assertIn('SN002', email.body)
    
    @patch('notifications.utils.get_customer_email')
    def test_send_delivery_shipped_email_no_customer_email(self, mock_get_email):
        """Test that email is not sent when customer email not found."""
        mock_get_email.return_value = None
        
        result = send_delivery_shipped_email(self.delivery)
        
        self.assertFalse(result)
        self.assertEqual(len(mail.outbox), 0)


class TestPOExpiringEmail(TestCase):
    """Test send_po_expiring_soon_email function."""
    
    def setUp(self):
        """Set up test data."""
        self.item = Item.objects.create(
            name='Test Item',
            msrp=100.00,
            min_price=80.00,
            created_by_user_id='test-user'
        )
        
        self.po = PurchaseOrder.objects.create(
            po_number='PO-001',
            customer_id='cust-123',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=15),
            status='OPEN'
        )
        
        POLineItem.objects.create(
            po=self.po,
            item=self.item,
            quantity=10,
            price_per_unit=100.00
        )
    
    @patch('notifications.utils.get_admin_emails')
    def test_send_po_expiring_email_success(self, mock_get_admin_emails):
        """Test successful PO expiring email."""
        mock_get_admin_emails.return_value = ['admin@test.com']
        
        result = send_po_expiring_soon_email(self.po, 15)
        
        self.assertTrue(result)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertIn('PO Expiring Soon', email.subject)
        self.assertIn('PO-001', email.subject)
        self.assertEqual(email.to, ['admin@test.com'])
        self.assertIn('15', email.body)
        self.assertIn('cust-123', email.body)
    
    @patch('notifications.utils.get_admin_emails')
    def test_send_po_expiring_email_no_admins(self, mock_get_admin_emails):
        """Test that email is not sent when no admin emails configured."""
        mock_get_admin_emails.return_value = []
        
        result = send_po_expiring_soon_email(self.po, 15)
        
        self.assertFalse(result)
        self.assertEqual(len(mail.outbox), 0)


class TestPOReadyToCloseEmail(TestCase):
    """Test send_po_ready_to_close_email function."""
    
    def setUp(self):
        """Set up test data."""
        self.item = Item.objects.create(
            name='Test Item',
            msrp=100.00,
            min_price=80.00,
            created_by_user_id='test-user'
        )
        
        self.po = PurchaseOrder.objects.create(
            po_number='PO-001',
            customer_id='cust-123',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=30),
            status='OPEN'
        )
        
        POLineItem.objects.create(
            po=self.po,
            item=self.item,
            quantity=10,
            price_per_unit=100.00,
            waived_quantity=10
        )
    
    @patch('notifications.utils.get_admin_emails')
    def test_send_po_ready_to_close_email_success(self, mock_get_admin_emails):
        """Test successful PO ready to close email."""
        mock_get_admin_emails.return_value = ['admin@test.com']
        
        result = send_po_ready_to_close_email(self.po)
        
        self.assertTrue(result)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'PO Ready to Close: PO-001')
        self.assertEqual(email.to, ['admin@test.com'])
        self.assertIn('PO-001', email.body)
        self.assertIn('ready to be closed', email.body)


class TestOrderReadyToCloseEmail(TestCase):
    """Test send_order_ready_to_close_email function."""
    
    def setUp(self):
        """Set up test data."""
        self.item = Item.objects.create(
            name='Test Item',
            msrp=100.00,
            min_price=80.00,
            created_by_user_id='test-user'
        )
        
        self.order = Order.objects.create(
            order_number='ORD-001',
            customer_id='cust-123',
            status='OPEN'
        )
        
        OrderLineItem.objects.create(
            order=self.order,
            item=self.item,
            quantity=5,
            price_per_unit=100.00,
            waived_quantity=5
        )
    
    @patch('notifications.utils.get_admin_emails')
    def test_send_order_ready_to_close_email_success(self, mock_get_admin_emails):
        """Test successful Order ready to close email."""
        mock_get_admin_emails.return_value = ['admin@test.com']
        
        result = send_order_ready_to_close_email(self.order)
        
        self.assertTrue(result)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'Order Ready to Close: ORD-001')
        self.assertEqual(email.to, ['admin@test.com'])
        self.assertIn('ORD-001', email.body)
        self.assertIn('ready to be closed', email.body)


class TestCheckExpiringPOs(TestCase):
    """Test check_expiring_pos function."""
    
    def setUp(self):
        """Set up test data."""
        self.item = Item.objects.create(
            name='Test Item',
            msrp=100.00,
            min_price=80.00,
            created_by_user_id='test-user'
        )
        
        # PO expiring in 10 days
        self.po_expiring_soon = PurchaseOrder.objects.create(
            po_number='PO-001',
            customer_id='cust-123',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=10),
            status='OPEN'
        )
        POLineItem.objects.create(
            po=self.po_expiring_soon,
            item=self.item,
            quantity=10,
            price_per_unit=100.00
        )
        
        # PO expiring in 40 days (outside threshold)
        self.po_not_expiring = PurchaseOrder.objects.create(
            po_number='PO-002',
            customer_id='cust-123',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=40),
            status='OPEN'
        )
        POLineItem.objects.create(
            po=self.po_not_expiring,
            item=self.item,
            quantity=10,
            price_per_unit=100.00
        )
        
        # Already closed PO (should be ignored)
        self.po_closed = PurchaseOrder.objects.create(
            po_number='PO-003',
            customer_id='cust-123',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=5),
            status='CLOSED'
        )
    
    @patch('notifications.utils.get_admin_emails')
    def test_check_expiring_pos_with_email(self, mock_get_admin_emails):
        """Test check_expiring_pos with email sending."""
        mock_get_admin_emails.return_value = ['admin@test.com']
        
        results = check_expiring_pos(days_threshold=30, send_emails=True)
        
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['po'].po_number, 'PO-001')
        self.assertEqual(results[0]['days_until_expiration'], 10)
        
        # Check that email was sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('PO-001', mail.outbox[0].subject)
    
    @patch('notifications.utils.get_admin_emails')
    def test_check_expiring_pos_without_email(self, mock_get_admin_emails):
        """Test check_expiring_pos without sending emails."""
        mock_get_admin_emails.return_value = ['admin@test.com']
        
        results = check_expiring_pos(days_threshold=30, send_emails=False)
        
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['po'].po_number, 'PO-001')
        
        # Check that no email was sent
        self.assertEqual(len(mail.outbox), 0)
    
    def test_check_expiring_pos_different_threshold(self):
        """Test check_expiring_pos with different threshold."""
        results = check_expiring_pos(days_threshold=5, send_emails=False)
        
        # Should not find any POs expiring in 5 days (PO-001 expires in 10 days)
        self.assertEqual(len(results), 0)
