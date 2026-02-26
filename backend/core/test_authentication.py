"""
Tests for Authinator authentication.

Following Deft TDD principles.
"""
import pytest
from unittest.mock import Mock, patch
from core.authentication import AuthinatorUser, AuthinatorJWTAuthentication
from rest_framework.exceptions import AuthenticationFailed


class TestAuthinatorUser:
    """Test suite for AuthinatorUser class."""
    
    def test_create_user_from_data(self):
        """Test creating AuthinatorUser from user data."""
        user_data = {
            'id': 1,
            'username': 'testuser',
            'email': 'test@test.com',
            'role': 'SYSTEM_ADMIN',
            'customer_id': None,
            'customer_name': None,
            'is_verified': True,
            'is_active': True,
        }
        
        user = AuthinatorUser(user_data)
        
        assert user.id == 1
        assert user.username == 'testuser'
        assert user.email == 'test@test.com'
        assert user.role == 'SYSTEM_ADMIN'
        assert user.is_authenticated is True
    
    def test_is_system_admin(self):
        """Test is_system_admin method."""
        admin_data = {'id': 1, 'username': 'admin', 'email': 'a@test.com', 'role': 'SYSTEM_ADMIN'}
        user_data = {'id': 2, 'username': 'user', 'email': 'u@test.com', 'role': 'CUSTOMER_USER'}
        
        admin = AuthinatorUser(admin_data)
        user = AuthinatorUser(user_data)
        
        assert admin.is_system_admin() is True
        assert user.is_system_admin() is False
    
    def test_is_customer_admin(self):
        """Test is_customer_admin method."""
        admin_data = {'id': 1, 'username': 'admin', 'email': 'a@test.com', 'role': 'CUSTOMER_ADMIN', 'customer_id': 1}
        user_data = {'id': 2, 'username': 'user', 'email': 'u@test.com', 'role': 'CUSTOMER_USER', 'customer_id': 1}
        
        admin = AuthinatorUser(admin_data)
        user = AuthinatorUser(user_data)
        
        assert admin.is_customer_admin() is True
        assert user.is_customer_admin() is False
    
    def test_can_manage_users(self):
        """Test can_manage_users method."""
        sys_admin = AuthinatorUser({'id': 1, 'username': 'sa', 'email': 'sa@test.com', 'role': 'SYSTEM_ADMIN'})
        cust_admin = AuthinatorUser({'id': 2, 'username': 'ca', 'email': 'ca@test.com', 'role': 'CUSTOMER_ADMIN', 'customer_id': 1})
        cust_user = AuthinatorUser({'id': 3, 'username': 'cu', 'email': 'cu@test.com', 'role': 'CUSTOMER_USER', 'customer_id': 1})
        
        assert sys_admin.can_manage_users() is True
        assert cust_admin.can_manage_users() is True
        assert cust_user.can_manage_users() is False
    
    def test_can_edit_data(self):
        """Test can_edit_data method."""
        user = AuthinatorUser({'id': 1, 'username': 'user', 'email': 'u@test.com', 'role': 'CUSTOMER_USER', 'customer_id': 1})
        readonly = AuthinatorUser({'id': 2, 'username': 'ro', 'email': 'ro@test.com', 'role': 'CUSTOMER_READONLY', 'customer_id': 1})
        
        assert user.can_edit_data() is True
        assert readonly.can_edit_data() is False


@pytest.mark.django_db
class TestAuthinatorJWTAuthentication:
    """Test suite for AuthinatorJWTAuthentication class."""
    
    def test_authenticate_no_header(self):
        """Test authentication with no authorization header."""
        auth = AuthinatorJWTAuthentication()
        request = Mock()
        request.META = {}
        
        result = auth.authenticate(request)
        
        assert result is None
    
    def test_authenticate_invalid_header_format(self):
        """Test authentication with invalid header format."""
        auth = AuthinatorJWTAuthentication()
        request = Mock()
        request.META = {'HTTP_AUTHORIZATION': 'InvalidFormat'}
        
        with pytest.raises(AuthenticationFailed) as exc_info:
            auth.authenticate(request)
        
        assert 'Invalid authorization header format' in str(exc_info.value)
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_authenticate_invalid_token(self, mock_get_user):
        """Test authentication with invalid token."""
        mock_get_user.return_value = None
        
        auth = AuthinatorJWTAuthentication()
        request = Mock()
        request.META = {'HTTP_AUTHORIZATION': 'Bearer invalidtoken'}
        
        with pytest.raises(AuthenticationFailed) as exc_info:
            auth.authenticate(request)
        
        assert 'Invalid or expired token' in str(exc_info.value)
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_authenticate_unverified_user(self, mock_get_user):
        """Test authentication with unverified user."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'unverified',
            'email': 'unverified@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': False,
            'is_active': True,
        }
        
        auth = AuthinatorJWTAuthentication()
        request = Mock()
        request.META = {'HTTP_AUTHORIZATION': 'Bearer validtoken'}
        
        with pytest.raises(AuthenticationFailed) as exc_info:
            auth.authenticate(request)
        
        assert 'not verified' in str(exc_info.value)
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_authenticate_inactive_user(self, mock_get_user):
        """Test authentication with inactive user."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'inactive',
            'email': 'inactive@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'is_verified': True,
            'is_active': False,
        }
        
        auth = AuthinatorJWTAuthentication()
        request = Mock()
        request.META = {'HTTP_AUTHORIZATION': 'Bearer validtoken'}
        
        with pytest.raises(AuthenticationFailed) as exc_info:
            auth.authenticate(request)
        
        assert 'not active' in str(exc_info.value)
    
    @patch('core.authentication.authinator_client.get_user_from_token')
    def test_authenticate_success(self, mock_get_user):
        """Test successful authentication."""
        mock_get_user.return_value = {
            'id': 1,
            'username': 'testuser',
            'email': 'test@test.com',
            'role': 'CUSTOMER_USER',
            'customer_id': 1,
            'customer_name': 'Test Corp',
            'is_verified': True,
            'is_active': True,
        }
        
        auth = AuthinatorJWTAuthentication()
        request = Mock()
        request.META = {'HTTP_AUTHORIZATION': 'Bearer validtoken'}
        
        user, token = auth.authenticate(request)
        
        assert user.username == 'testuser'
        assert user.email == 'test@test.com'
        assert user.role == 'CUSTOMER_USER'
        assert user.customer_id == 1
        assert token == 'validtoken'
