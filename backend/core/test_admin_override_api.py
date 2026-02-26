"""
Tests for AdminOverride API endpoint.

Following Deft TDD principles.
"""
import pytest
from django.test import Client
from unittest.mock import patch
from core.models import AdminOverride


@pytest.mark.django_db
class TestAdminOverrideListAPI:
    """Test suite for AdminOverride list endpoint."""
    
    @pytest.fixture
    def create_overrides(self):
        """Create sample admin overrides for testing."""
        AdminOverride.objects.create(
            entity_type='PO',
            entity_id=1,
            entity_number='PO-001',
            override_type='CLOSE',
            reason='Force close due to customer request',
            user_id='admin-123',
            user_email='admin@test.com',
            metadata={'original_status': 'OPEN'}
        )
        AdminOverride.objects.create(
            entity_type='ORDER',
            entity_id=2,
            entity_number='ORD-002',
            override_type='WAIVE',
            reason='Partial shipment accepted',
            user_id='admin-456',
            user_email='admin2@test.com',
            metadata={'waived_quantity': 5}
        )
        AdminOverride.objects.create(
            entity_type='PO',
            entity_id=3,
            entity_number='PO-003',
            override_type='CLOSE',
            reason='Expired PO cleanup',
            user_id='admin-123',
            user_email='admin@test.com'
        )
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_list_overrides_as_system_admin(self, mock_get_user, create_overrides):
        """Test that system admins can list all overrides."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/admin-overrides/',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'results' in data  # Paginated response
        assert len(data['results']) == 3
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_list_overrides_as_customer_user_fails(self, mock_get_user, create_overrides):
        """Test that customer users cannot list overrides."""
        mock_get_user.return_value = {
            'id': 'user-1',
            'username': 'customer',
            'email': 'customer@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 'cust-1',
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/admin-overrides/',
            HTTP_AUTHORIZATION='Bearer customer-token'
        )
        
        assert response.status_code == 403
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_filter_overrides_by_entity_type(self, mock_get_user, create_overrides):
        """Test filtering overrides by entity type."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/admin-overrides/?entity_type=PO',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data['results']) == 2
        assert all(item['entity_type'] == 'PO' for item in data['results'])
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_filter_overrides_by_entity_id(self, mock_get_user, create_overrides):
        """Test filtering overrides by entity ID."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/admin-overrides/?entity_id=1',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data['results']) == 1
        assert data['results'][0]['entity_id'] == 1
        assert data['results'][0]['entity_number'] == 'PO-001'
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_filter_overrides_by_user_id(self, mock_get_user, create_overrides):
        """Test filtering overrides by user who performed them."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/admin-overrides/?user_id=admin-123',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data['results']) == 2
        assert all(item['user_id'] == 'admin-123' for item in data['results'])
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_filter_overrides_combined(self, mock_get_user, create_overrides):
        """Test filtering with multiple parameters."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/admin-overrides/?entity_type=PO&user_id=admin-123',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data['results']) == 2
        assert all(item['entity_type'] == 'PO' for item in data['results'])
        assert all(item['user_id'] == 'admin-123' for item in data['results'])


@pytest.mark.django_db
class TestAdminOverrideDetailAPI:
    """Test suite for AdminOverride detail endpoint."""
    
    @pytest.fixture
    def override(self):
        """Create a test admin override."""
        return AdminOverride.objects.create(
            entity_type='PO',
            entity_id=1,
            entity_number='PO-001',
            override_type='CLOSE',
            reason='Force close due to customer request',
            user_id='admin-123',
            user_email='admin@test.com',
            metadata={'original_status': 'OPEN', 'unfulfilled_items': True}
        )
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_get_override_detail(self, mock_get_user, override):
        """Test getting override details."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            f'/api/fulfil/admin-overrides/{override.id}/',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['entity_type'] == 'PO'
        assert data['entity_type_display'] == 'Purchase Order'
        assert data['entity_number'] == 'PO-001'
        assert data['override_type'] == 'CLOSE'
        assert data['override_type_display'] == 'Force Close'
        assert data['reason'] == 'Force close due to customer request'
        assert data['user_id'] == 'admin-123'
        assert data['user_email'] == 'admin@test.com'
        assert data['metadata']['unfulfilled_items'] is True
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_cannot_create_override_via_api(self, mock_get_user):
        """Test that overrides cannot be created directly via API."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.post(
            '/api/fulfil/admin-overrides/',
            {
                'entity_type': 'PO',
                'entity_id': 1,
                'entity_number': 'PO-001',
                'override_type': 'CLOSE',
                'reason': 'Test',
                'user_id': 'admin-123'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        # Should return 405 Method Not Allowed (read-only viewset)
        assert response.status_code == 405
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_cannot_update_override_via_api(self, mock_get_user, override):
        """Test that overrides cannot be updated via API."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.put(
            f'/api/fulfil/admin-overrides/{override.id}/',
            {
                'reason': 'Updated reason'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        # Should return 405 Method Not Allowed (read-only viewset)
        assert response.status_code == 405
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_cannot_delete_override_via_api(self, mock_get_user, override):
        """Test that overrides cannot be deleted via API."""
        mock_get_user.return_value = {
            'id': 'admin-123',
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.delete(
            f'/api/fulfil/admin-overrides/{override.id}/',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        # Should return 405 Method Not Allowed (read-only viewset)
        assert response.status_code == 405
