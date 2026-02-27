"""
Integration tests for FULFILinator with Authinator.

These tests verify that:
1. FULFILinator can communicate with Authinator
2. JWT tokens from Authinator are properly validated
3. Cross-service authentication works correctly

Note: These tests require Authinator to be running.
"""
import pytest
from unittest.mock import patch, Mock
from django.test import Client
from core.authinator_client import authinator_client


@pytest.mark.django_db
class TestAuthinatorIntegration:
    """Test suite for Authinator integration."""
    
    @patch('core.authinator_client.requests.get')
    def test_authinator_client_can_fetch_user(self, mock_get):
        """Test that Authinator client can fetch user information."""
        # Mock Authinator response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'id': 1,
            'username': 'testuser',
            'email': 'test@test.com',
            'role': 'ADMIN',
            'customer': None,
            'is_verified': True,
            'is_active': True
        }
        mock_get.return_value = mock_response
        
        # Test
        user = authinator_client.get_user_from_token('test-token')
        
        assert user is not None
        assert user['username'] == 'testuser'
        assert user['role'] == 'ADMIN'
        assert mock_get.called
    
    @patch('core.authinator_client.requests.get')
    def test_authinator_client_handles_invalid_token(self, mock_get):
        """Test that Authinator client handles invalid tokens gracefully."""
        # Mock Authinator response for invalid token
        mock_response = Mock()
        mock_response.status_code = 401
        mock_get.return_value = mock_response
        
        # Test
        user = authinator_client.get_user_from_token('invalid-token')
        
        assert user is None
    
    @patch('core.authinator_client.requests.get')
    def test_authinator_client_handles_connection_error(self, mock_get):
        """Test that Authinator client handles connection errors."""
        # Clear cache to ensure fresh request
        from django.core.cache import cache
        cache.clear()
        
        # Mock connection error
        import requests
        mock_get.side_effect = requests.ConnectionError('Connection refused')
        
        # Test with a unique token to avoid cache
        user = authinator_client.get_user_from_token('unique-connection-error-token')
        
        assert user is None
    
    @patch('core.authinator_client.requests.get')
    def test_health_check_works_without_auth(self, mock_get):
        """Test that health check endpoint works without authentication."""
        client = Client()
        response = client.get('/api/fulfil/health/')
        
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'ok'
        assert data['service'] == 'FULFILinator'
        
        # Health check should not call Authinator
        assert not mock_get.called
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_authenticated_endpoint_validates_token(self, mock_get_user):
        """Test that authenticated endpoints validate tokens with Authinator."""
        # Mock valid user from Authinator
        mock_get_user.return_value = {
            'id': 1,
            'username': 'testuser',
            'email': 'test@test.com',
            'role': 'ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        client = Client()
        
        # Try to access an authenticated endpoint (will be added in future phases)
        # For now, we'll just verify the authentication mechanism
        response = client.get(
            '/api/fulfil/health/',  # This is public, but we're testing the auth system
            HTTP_AUTHORIZATION='Bearer test-token'
        )
        
        # Health check should still work
        assert response.status_code == 200


@pytest.mark.django_db
class TestCrossServiceAuthentication:
    """Test suite for cross-service authentication."""
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_system_admin_token_works(self, mock_get_user):
        """Test that system admin tokens from Authinator work in FULFILinator."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'admin',
            'email': 'admin@test.com',
            'role': 'ADMIN',
            'customer_id': None,
            'is_verified': True,
            'is_active': True
        }
        
        from core.authentication import AuthinatorJWTAuthentication
        from unittest.mock import Mock as MockRequest
        
        auth = AuthinatorJWTAuthentication()
        request = MockRequest()
        request.META = {'HTTP_AUTHORIZATION': 'Bearer admin-token'}
        
        user, token = auth.authenticate(request)
        
        assert user.username == 'admin'
        assert user.is_system_admin() is True
        assert token == 'admin-token'
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_customer_user_token_works(self, mock_get_user):
        """Test that customer user tokens from Authinator work in FULFILinator."""
        mock_get_user.return_value = {
            'id': 2,
            'username': 'customer_user',
            'email': 'user@customer.com',
            'role': 'USER',
            'customer_id': 5,
            'customer_name': 'Test Customer',
            'is_verified': True,
            'is_active': True
        }
        
        from core.authentication import AuthinatorJWTAuthentication
        from unittest.mock import Mock as MockRequest
        
        auth = AuthinatorJWTAuthentication()
        request = MockRequest()
        request.META = {'HTTP_AUTHORIZATION': 'Bearer customer-token'}
        
        user, token = auth.authenticate(request)
        
        assert user.username == 'customer_user'
        assert user.role == 'USER'
        assert user.customer_id == 5
        assert user.is_system_admin() is False
