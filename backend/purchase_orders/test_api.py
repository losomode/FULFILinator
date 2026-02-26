"""
API tests for purchase_orders app.
Following TDD - write tests before implementation.
"""
import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem


class PurchaseOrderAPITestCase(TestCase):
    """Test PurchaseOrder API endpoints."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()
        
        # Create test items
        self.item1 = Item.objects.create(
            name="Widget",
            version="1.0",
            msrp=Decimal("100.00"),
            min_price=Decimal("80.00"),
            created_by_user_id="user-123"
        )
        self.item2 = Item.objects.create(
            name="Gadget",
            version="2.0",
            msrp=Decimal("200.00"),
            min_price=Decimal("150.00"),
            created_by_user_id="user-123"
        )
        
        # Mock Authinator responses
        self.system_admin_token = "system-admin-token"
        self.customer_admin_token = "customer-admin-token"
        self.customer_user_token = "customer-user-token"
        
        self.system_admin_user = {
            "user_id": "sys-admin-1",
            "email": "admin@system.com",
            "first_name": "System",
            "last_name": "Admin",
            "customer_id": None,
            "role": "SYSTEM_ADMIN"
        }
        
        self.customer_admin_user = {
            "user_id": "cust-admin-1",
            "email": "admin@customer.com",
            "first_name": "Customer",
            "last_name": "Admin",
            "customer_id": "cust-123",
            "role": "CUSTOMER_ADMIN"
        }
        
        self.customer_user_user = {
            "user_id": "cust-user-1",
            "email": "user@customer.com",
            "first_name": "Customer",
            "last_name": "User",
            "customer_id": "cust-123",
            "role": "CUSTOMER_USER"
        }
    
    def _authenticate_as(self, user_data, token):
        """Helper to set authentication header and mock get_user_from_token."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        patcher = patch('core.authinator_client.authinator_client.get_user_from_token')
        mock_get_user = patcher.start()
        # AuthinatorUser expects specific fields
        user_data_with_defaults = {
            'id': user_data['user_id'],  # Map user_id to id
            'username': user_data['email'],
            'email': user_data['email'],
            'first_name': user_data.get('first_name', ''),
            'last_name': user_data.get('last_name', ''),
            'customer_id': user_data.get('customer_id'),
            'role': user_data['role'],
            'is_verified': True,
            'is_active': True
        }
        mock_get_user.return_value = user_data_with_defaults
        self.addCleanup(patcher.stop)
        return mock_get_user
    
    def test_list_purchase_orders_as_system_admin(self):
        """System admins can list all purchase orders."""
        # Create POs for different customers
        po1 = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po2 = PurchaseOrder.objects.create(
            customer_id="cust-456",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Response is paginated, check results
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_list_purchase_orders_as_customer_admin(self):
        """Customer admins can only see their own customer's purchase orders."""
        # Create POs for different customers
        po1 = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        po2 = PurchaseOrder.objects.create(
            customer_id="cust-456",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.customer_admin_user, self.customer_admin_token)
        
        url = reverse('purchaseorder-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Response is paginated, check results
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['customer_id'], 'cust-123')
    
    def test_create_purchase_order_as_system_admin(self):
        """System admins can create purchase orders with line items."""
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-list')
        data = {
            'customer_id': 'cust-123',
            'start_date': str(date.today()),
            'expiration_date': str(date.today() + timedelta(days=30)),
            'notes': 'Test PO',
            'line_items': [
                {
                    'item': self.item1.id,
                    'quantity': 10,
                    'price_per_unit': '90.00'
                },
                {
                    'item': self.item2.id,
                    'quantity': 5,
                    'price_per_unit': '180.00'
                }
            ]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('po_number', response.data)
        self.assertEqual(response.data['customer_id'], 'cust-123')
        self.assertEqual(response.data['status'], 'OPEN')
        self.assertEqual(len(response.data['line_items']), 2)
        self.assertEqual(response.data['created_by_user_id'], 'sys-admin-1')
        
        # Verify DB
        po = PurchaseOrder.objects.get(id=response.data['id'])
        self.assertEqual(po.line_items.count(), 2)
    
    def test_create_purchase_order_as_customer_admin_forbidden(self):
        """Customer admins cannot create purchase orders."""
        self._authenticate_as(self.customer_admin_user, self.customer_admin_token)
        
        url = reverse('purchaseorder-list')
        data = {
            'customer_id': 'cust-123',
            'start_date': str(date.today()),
            'expiration_date': str(date.today() + timedelta(days=30)),
            'line_items': []
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_create_purchase_order_without_line_items(self):
        """Can create PO without line items initially."""
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-list')
        data = {
            'customer_id': 'cust-123',
            'start_date': str(date.today()),
            'expiration_date': str(date.today() + timedelta(days=30)),
            'line_items': []
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['line_items']), 0)
    
    def test_retrieve_purchase_order(self):
        """Can retrieve a single purchase order with line items."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=self.item1,
            quantity=10,
            price_per_unit=Decimal("90.00")
        )
        
        self._authenticate_as(self.customer_admin_user, self.customer_admin_token)
        
        url = reverse('purchaseorder-detail', args=[po.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], po.id)
        self.assertEqual(len(response.data['line_items']), 1)
        self.assertIn('fulfillment_status', response.data)
    
    def test_update_purchase_order_as_system_admin(self):
        """System admins can update purchase orders."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-detail', args=[po.id])
        data = {
            'customer_id': 'cust-123',
            'start_date': str(date.today()),
            'expiration_date': str(date.today() + timedelta(days=60)),
            'notes': 'Updated notes',
            'line_items': [
                {
                    'item': self.item1.id,
                    'quantity': 20,
                    'price_per_unit': '85.00'
                }
            ]
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['notes'], 'Updated notes')
        self.assertEqual(len(response.data['line_items']), 1)
        
        # Verify old line items removed
        po.refresh_from_db()
        self.assertEqual(po.line_items.count(), 1)
    
    def test_update_purchase_order_as_customer_admin_forbidden(self):
        """Customer admins cannot update purchase orders."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.customer_admin_user, self.customer_admin_token)
        
        url = reverse('purchaseorder-detail', args=[po.id])
        data = {
            'customer_id': 'cust-123',
            'start_date': str(date.today()),
            'expiration_date': str(date.today() + timedelta(days=60)),
            'line_items': []
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_delete_purchase_order_as_system_admin(self):
        """System admins can delete purchase orders."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-detail', args=[po.id])
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PurchaseOrder.objects.filter(id=po.id).exists())
    
    def test_fulfillment_status_calculation_no_orders(self):
        """Fulfillment status shows all quantities remaining when no orders."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        POLineItem.objects.create(
            po=po,
            item=self.item1,
            quantity=10,
            price_per_unit=Decimal("90.00")
        )
        POLineItem.objects.create(
            po=po,
            item=self.item2,
            quantity=5,
            price_per_unit=Decimal("180.00")
        )
        
        self._authenticate_as(self.customer_admin_user, self.customer_admin_token)
        
        url = reverse('purchaseorder-detail', args=[po.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        fulfillment = response.data['fulfillment_status']
        self.assertEqual(len(fulfillment), 2)
        
        # Find items in fulfillment status
        item1_status = next(f for f in fulfillment if f['item_id'] == self.item1.id)
        item2_status = next(f for f in fulfillment if f['item_id'] == self.item2.id)
        
        self.assertEqual(item1_status['po_quantity'], 10)
        self.assertEqual(item1_status['ordered_quantity'], 0)
        self.assertEqual(item1_status['remaining_quantity'], 10)
        
        self.assertEqual(item2_status['po_quantity'], 5)
        self.assertEqual(item2_status['ordered_quantity'], 0)
        self.assertEqual(item2_status['remaining_quantity'], 5)
    
    def test_close_purchase_order(self):
        """Can close a purchase order."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-close', args=[po.id])
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'CLOSED')
        self.assertIsNotNone(response.data['closed_at'])
        self.assertEqual(response.data['closed_by_user_id'], 'sys-admin-1')
    
    def test_close_already_closed_purchase_order(self):
        """Cannot close an already closed purchase order."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            status='CLOSED',
            created_by_user_id="sys-admin-1",
            closed_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-close', args=[po.id])
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_waive_remaining_quantity(self):
        """Can waive remaining quantity for a line item."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        line_item = POLineItem.objects.create(
            po=po,
            item=self.item1,
            quantity=10,
            price_per_unit=Decimal("90.00")
        )
        
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-waive', args=[po.id])
        data = {
            'line_item_id': line_item.id,
            'quantity_to_waive': 3
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
    
    def test_waive_invalid_quantity(self):
        """Cannot waive more than remaining quantity."""
        po = PurchaseOrder.objects.create(
            customer_id="cust-123",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        line_item = POLineItem.objects.create(
            po=po,
            item=self.item1,
            quantity=10,
            price_per_unit=Decimal("90.00")
        )
        
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-waive', args=[po.id])
        data = {
            'line_item_id': line_item.id,
            'quantity_to_waive': 20  # More than PO quantity
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_price_validation_below_min_price(self):
        """Price per unit cannot be below item min_price without admin override."""
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-list')
        data = {
            'customer_id': 'cust-123',
            'start_date': str(date.today()),
            'expiration_date': str(date.today() + timedelta(days=30)),
            'line_items': [
                {
                    'item': self.item1.id,
                    'quantity': 10,
                    'price_per_unit': '70.00'  # Below min_price of 80.00
                }
            ]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('price_per_unit', str(response.data))
    
    def test_price_validation_with_admin_override(self):
        """Can set price below min_price with admin_override flag."""
        self._authenticate_as(self.system_admin_user, self.system_admin_token)
        
        url = reverse('purchaseorder-list')
        data = {
            'customer_id': 'cust-123',
            'start_date': str(date.today()),
            'expiration_date': str(date.today() + timedelta(days=30)),
            'line_items': [
                {
                    'item': self.item1.id,
                    'quantity': 10,
                    'price_per_unit': '70.00',
                    'admin_override': True
                }
            ]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_customer_data_isolation(self):
        """Customer users cannot access other customers' purchase orders."""
        po_other = PurchaseOrder.objects.create(
            customer_id="cust-456",
            start_date=date.today(),
            expiration_date=date.today() + timedelta(days=30),
            created_by_user_id="sys-admin-1"
        )
        
        self._authenticate_as(self.customer_admin_user, self.customer_admin_token)
        
        url = reverse('purchaseorder-detail', args=[po_other.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_unauthenticated_access_forbidden(self):
        """Unauthenticated requests are forbidden."""
        url = reverse('purchaseorder-list')
        response = self.client.get(url)
        
        # DRF returns 403 when authentication is missing but permission is checked
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
