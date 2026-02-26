"""
Tests for purchase_orders management commands.
"""
import pytest
from io import StringIO
from django.core.management import call_command
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from decimal import Decimal

from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem


@pytest.mark.django_db
class TestCheckExpiringPOsCommand:
    """Test suite for check_expiring_pos management command."""
    
    @pytest.fixture
    def setup_pos(self):
        """Create test POs with various expiration dates."""
        item = Item.objects.create(
            name='Test Item',
            msrp=Decimal('100.00'),
            min_price=Decimal('80.00'),
            created_by_user_id='test-user'
        )
        
        # PO expiring in 5 days
        po1 = PurchaseOrder.objects.create(
            po_number='PO-001',
            customer_id='cust-123',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=5),
            status='OPEN'
        )
        POLineItem.objects.create(
            po=po1,
            item=item,
            quantity=10,
            price_per_unit=Decimal('100.00')
        )
        
        # PO expiring in 15 days
        po2 = PurchaseOrder.objects.create(
            po_number='PO-002',
            customer_id='cust-456',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=15),
            status='OPEN'
        )
        POLineItem.objects.create(
            po=po2,
            item=item,
            quantity=5,
            price_per_unit=Decimal('100.00')
        )
        
        # PO expiring in 45 days (outside 30-day threshold)
        po3 = PurchaseOrder.objects.create(
            po_number='PO-003',
            customer_id='cust-789',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=45),
            status='OPEN'
        )
        POLineItem.objects.create(
            po=po3,
            item=item,
            quantity=20,
            price_per_unit=Decimal('100.00')
        )
        
        # Already closed PO (should be ignored)
        po4 = PurchaseOrder.objects.create(
            po_number='PO-004',
            customer_id='cust-123',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=10),
            status='CLOSED'
        )
        POLineItem.objects.create(
            po=po4,
            item=item,
            quantity=15,
            price_per_unit=Decimal('100.00')
        )
        
        return {'po1': po1, 'po2': po2, 'po3': po3, 'po4': po4}
    
    @patch('purchase_orders.management.commands.check_expiring_pos.check_expiring_pos')
    def test_command_runs_with_defaults(self, mock_check, setup_pos):
        """Test that command runs with default parameters."""
        mock_check.return_value = []
        
        out = StringIO()
        call_command('check_expiring_pos', stdout=out)
        
        # Verify check_expiring_pos was called with defaults
        mock_check.assert_called_once_with(days_threshold=30, send_emails=True)
        
        # Check output
        output = out.getvalue()
        assert 'Checking for POs expiring within 30 days' in output
    
    @patch('purchase_orders.management.commands.check_expiring_pos.check_expiring_pos')
    def test_command_with_custom_days(self, mock_check, setup_pos):
        """Test command with custom days parameter."""
        mock_check.return_value = []
        
        out = StringIO()
        call_command('check_expiring_pos', '--days', '7', stdout=out)
        
        mock_check.assert_called_once_with(days_threshold=7, send_emails=True)
        
        output = out.getvalue()
        assert 'Checking for POs expiring within 7 days' in output
    
    @patch('purchase_orders.management.commands.check_expiring_pos.check_expiring_pos')
    def test_command_with_no_email_flag(self, mock_check, setup_pos):
        """Test command with --no-email flag."""
        mock_check.return_value = []
        
        out = StringIO()
        call_command('check_expiring_pos', '--no-email', stdout=out)
        
        mock_check.assert_called_once_with(days_threshold=30, send_emails=False)
    
    @patch('purchase_orders.management.commands.check_expiring_pos.check_expiring_pos')
    def test_command_reports_expiring_pos(self, mock_check, setup_pos):
        """Test that command properly reports found expiring POs."""
        # Mock return value with expiring POs
        mock_check.return_value = [
            {'po': setup_pos['po1'], 'days_until_expiration': 5},
            {'po': setup_pos['po2'], 'days_until_expiration': 15}
        ]
        
        out = StringIO()
        call_command('check_expiring_pos', stdout=out)
        
        output = out.getvalue()
        assert 'Found 2 expiring PO(s)' in output
        assert 'PO-001' in output
        assert 'expires in 5 day(s)' in output
        assert 'PO-002' in output
        assert 'expires in 15 day(s)' in output
        assert 'Sent 2 email notification(s)' in output
    
    @patch('purchase_orders.management.commands.check_expiring_pos.check_expiring_pos')
    def test_command_no_expiring_pos_found(self, mock_check, setup_pos):
        """Test command when no expiring POs are found."""
        mock_check.return_value = []
        
        out = StringIO()
        call_command('check_expiring_pos', stdout=out)
        
        output = out.getvalue()
        assert 'No expiring POs found' in output
    
    def test_command_integration_without_mocks(self, setup_pos):
        """Integration test: run command without mocks to verify end-to-end."""
        out = StringIO()
        
        # Run with 30-day threshold (should find PO-001 and PO-002)
        call_command('check_expiring_pos', '--days', '30', '--no-email', stdout=out)
        
        output = out.getvalue()
        assert 'Found 2 expiring PO(s)' in output
        assert 'PO-001' in output
        assert 'PO-002' in output
        assert 'PO-003' not in output  # 45 days out
        assert 'PO-004' not in output  # Closed
    
    def test_command_integration_with_smaller_threshold(self, setup_pos):
        """Test command with smaller threshold finds fewer POs."""
        out = StringIO()
        
        # Run with 7-day threshold (should only find PO-001)
        call_command('check_expiring_pos', '--days', '7', '--no-email', stdout=out)
        
        output = out.getvalue()
        assert 'Found 1 expiring PO(s)' in output
        assert 'PO-001' in output
        assert 'PO-002' not in output
