"""
Tests for Item API endpoints.

Following Deft TDD: Tests written BEFORE implementation.
Target: ≥80% coverage
"""
import pytest
from decimal import Decimal
from django.test import Client
from unittest.mock import patch
from items.models import Item


@pytest.mark.django_db
class TestItemListAPI:
    """Test suite for Item list endpoint (GET /api/fulfil/items/)."""
    
    @pytest.fixture
    def create_items(self):
        """Create sample items for testing."""
        Item.objects.create(
            name="Camera LR",
            version="1.0",
            description="Long range camera",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="1"
        )
        Item.objects.create(
            name="Node",
            version="4.6",
            description="Processing node",
            msrp=Decimal("499.99"),
            min_price=Decimal("399.99"),
            created_by_user_id="1"
        )
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_list_items_as_authenticated_user(self, mock_get_user, create_items):
        """Test that authenticated users can list items."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'testuser',
            'email': 'test@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/items/',
            HTTP_AUTHORIZATION='Bearer test-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]['name'] == 'Camera LR'
        assert data[1]['name'] == 'Node'
    
    def test_list_items_without_auth_fails(self, create_items):
        """Test that listing items without authentication fails."""
        client = Client()
        response = client.get('/api/fulfil/items/')
        
        # DRF returns 403 when no credentials provided (vs 401 for invalid credentials)
        assert response.status_code == 403


@pytest.mark.django_db
class TestItemDetailAPI:
    """Test suite for Item detail endpoint (GET /api/fulfil/items/{id}/)."""
    
    @pytest.fixture
    def item(self):
        """Create a test item."""
        return Item.objects.create(
            name="Camera LR",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="1"
        )
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_get_item_detail(self, mock_get_user, item):
        """Test getting item details."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'testuser',
            'email': 'test@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            f'/api/fulfil/items/{item.id}/',
            HTTP_AUTHORIZATION='Bearer test-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == 'Camera LR'
        assert data['version'] == '1.0'
        assert data['msrp'] == '999.99'
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_get_nonexistent_item(self, mock_get_user):
        """Test getting a non-existent item returns 404."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'testuser',
            'email': 'test@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.get(
            '/api/fulfil/items/99999/',
            HTTP_AUTHORIZATION='Bearer test-token'
        )
        
        assert response.status_code == 404


@pytest.mark.django_db
class TestItemCreateAPI:
    """Test suite for Item create endpoint (POST /api/fulfil/items/)."""
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_create_item_as_system_admin(self, mock_get_user):
        """Test that system admins can create items."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.post(
            '/api/fulfil/items/',
            {
                'name': 'New Camera',
                'version': '2.0',
                'description': 'Next gen camera',
                'msrp': '1299.99',
                'min_price': '999.99'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data['name'] == 'New Camera'
        assert data['version'] == '2.0'
        
        # Verify item was created in database
        item = Item.objects.get(name='New Camera')
        assert item.created_by_user_id == "1"  # From mocked user id
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_create_item_as_customer_user_fails(self, mock_get_user):
        """Test that customer users cannot create items."""
        mock_get_user.return_value = {
            'id': 2,
            'username': 'customer',
            'email': 'customer@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.post(
            '/api/fulfil/items/',
            {
                'name': 'New Camera',
                'msrp': '1299.99',
                'min_price': '999.99'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer customer-token'
        )
        
        assert response.status_code == 403
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_create_item_with_invalid_data(self, mock_get_user):
        """Test creating item with invalid data fails validation."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.post(
            '/api/fulfil/items/',
            {
                'name': 'Invalid Item',
                'msrp': '-100.00',  # Invalid: negative price
                'min_price': '50.00'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 400


@pytest.mark.django_db
class TestItemUpdateAPI:
    """Test suite for Item update endpoint (PUT /api/fulfil/items/{id}/)."""
    
    @pytest.fixture
    def item(self):
        """Create a test item."""
        return Item.objects.create(
            name="Camera LR",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="1"
        )
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_update_item_as_system_admin(self, mock_get_user, item):
        """Test that system admins can update items."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.put(
            f'/api/fulfil/items/{item.id}/',
            {
                'name': 'Camera LR',
                'version': '1.1',  # Updated version
                'description': 'Updated description',
                'msrp': '1099.99',  # Updated price
                'min_price': '899.99'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['version'] == '1.1'
        assert data['msrp'] == '1099.99'
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_update_item_as_customer_user_fails(self, mock_get_user, item):
        """Test that customer users cannot update items."""
        mock_get_user.return_value = {
            'id': 2,
            'username': 'customer',
            'email': 'customer@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.put(
            f'/api/fulfil/items/{item.id}/',
            {
                'name': 'Camera LR',
                'version': '1.1',
                'msrp': '1099.99',
                'min_price': '899.99'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer customer-token'
        )
        
        assert response.status_code == 403


@pytest.mark.django_db
class TestItemDeleteAPI:
    """Test suite for Item delete endpoint (DELETE /api/fulfil/items/{id}/)."""
    
    @pytest.fixture
    def item(self):
        """Create a test item."""
        return Item.objects.create(
            name="Camera LR",
            version="1.0",
            msrp=Decimal("999.99"),
            min_price=Decimal("799.99"),
            created_by_user_id="1"
        )
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_delete_item_as_system_admin(self, mock_get_user, item):
        """Test that system admins can delete items."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        item_id = item.id
        
        client = Client()
        response = client.delete(
            f'/api/fulfil/items/{item_id}/',
            HTTP_AUTHORIZATION='Bearer admin-token'
        )
        
        assert response.status_code == 204
        
        # Verify item was deleted
        assert not Item.objects.filter(id=item_id).exists()
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_delete_item_as_customer_user_fails(self, mock_get_user, item):
        """Test that customer users cannot delete items."""
        mock_get_user.return_value = {
            'id': 2,
            'username': 'customer',
            'email': 'customer@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        response = client.delete(
            f'/api/fulfil/items/{item.id}/',
            HTTP_AUTHORIZATION='Bearer customer-token'
        )
        
        assert response.status_code == 403
        
        # Verify item still exists
        assert Item.objects.filter(id=item.id).exists()
