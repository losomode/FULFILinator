"""
Tests for permission classes.

Following Deft TDD principles.
"""
import pytest
from unittest.mock import Mock
from core.permissions import (
    IsSystemAdmin,
    IsSystemAdminOrCustomerAdmin,
    CanEditData,
    IsOwnerOrSystemAdmin,
    CustomerDataIsolation
)
from core.authentication import AuthinatorUser


class TestIsSystemAdmin:
    """Test suite for IsSystemAdmin permission."""
    
    def test_allows_system_admin(self):
        """Test that system admins are allowed."""
        permission = IsSystemAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN', 'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_denies_customer_admin(self):
        """Test that customer admins are denied."""
        permission = IsSystemAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'CUSTOMER_ADMIN', 'customer_id': 1,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is False
    
    def test_denies_unauthenticated(self):
        """Test that unauthenticated users are denied."""
        permission = IsSystemAdmin()
        request = Mock()
        request.user = None
        
        assert permission.has_permission(request, None) is False


class TestIsSystemAdminOrCustomerAdmin:
    """Test suite for IsSystemAdminOrCustomerAdmin permission."""
    
    def test_allows_system_admin(self):
        """Test that system admins are allowed."""
        permission = IsSystemAdminOrCustomerAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN', 'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_allows_customer_admin(self):
        """Test that customer admins are allowed."""
        permission = IsSystemAdminOrCustomerAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'CUSTOMER_ADMIN', 'customer_id': 1,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_denies_customer_user(self):
        """Test that customer users are denied."""
        permission = IsSystemAdminOrCustomerAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'CUSTOMER_USER', 'customer_id': 1,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is False


class TestCanEditData:
    """Test suite for CanEditData permission."""
    
    def test_allows_safe_methods_for_all_users(self):
        """Test that GET requests are allowed for all users."""
        permission = CanEditData()
        request = Mock()
        request.method = 'GET'
        request.user = AuthinatorUser({
            'id': 1, 'username': 'ro', 'email': 'ro@test.com',
            'role': 'CUSTOMER_READONLY', 'customer_id': 1,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_allows_post_for_non_readonly_users(self):
        """Test that POST is allowed for non-readonly users."""
        permission = CanEditData()
        request = Mock()
        request.method = 'POST'
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'CUSTOMER_USER', 'customer_id': 1,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_denies_post_for_readonly_users(self):
        """Test that POST is denied for readonly users."""
        permission = CanEditData()
        request = Mock()
        request.method = 'POST'
        request.user = AuthinatorUser({
            'id': 1, 'username': 'ro', 'email': 'ro@test.com',
            'role': 'CUSTOMER_READONLY', 'customer_id': 1,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is False
    
    def test_denies_unauthenticated(self):
        """Test that unauthenticated users are denied."""
        permission = CanEditData()
        request = Mock()
        request.method = 'GET'
        request.user = None
        
        assert permission.has_permission(request, None) is False


class TestIsOwnerOrSystemAdmin:
    """Test suite for IsOwnerOrSystemAdmin permission."""
    
    def test_allows_system_admin_access_to_any_object(self):
        """Test that system admins can access any object."""
        permission = IsOwnerOrSystemAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN', 'is_verified': True, 'is_active': True
        })
        
        obj = Mock()
        obj.customer_id = 999
        
        assert permission.has_object_permission(request, None, obj) is True
    
    def test_allows_owner_access_to_own_object(self):
        """Test that users can access their own customer's objects."""
        permission = IsOwnerOrSystemAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'CUSTOMER_USER', 'customer_id': 5,
            'is_verified': True, 'is_active': True
        })
        
        obj = Mock()
        obj.customer_id = 5
        
        assert permission.has_object_permission(request, None, obj) is True
    
    def test_denies_access_to_other_customer_object(self):
        """Test that users cannot access other customer's objects."""
        permission = IsOwnerOrSystemAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'CUSTOMER_USER', 'customer_id': 5,
            'is_verified': True, 'is_active': True
        })
        
        obj = Mock()
        obj.customer_id = 10
        
        assert permission.has_object_permission(request, None, obj) is False


class TestCustomerDataIsolation:
    """Test suite for CustomerDataIsolation permission."""
    
    def test_allows_system_admin(self):
        """Test that system admins pass permission check."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN', 'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_allows_customer_user_with_customer_id(self):
        """Test that customer users with customer_id pass permission check."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'CUSTOMER_USER', 'customer_id': 5,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_system_admin_can_access_any_object(self):
        """Test that system admins can access any object."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'SYSTEM_ADMIN', 'is_verified': True, 'is_active': True
        })
        
        obj = Mock()
        obj.customer_id = 999
        
        assert permission.has_object_permission(request, None, obj) is True
    
    def test_customer_user_can_access_own_customer_object(self):
        """Test that customer users can access their customer's objects."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'CUSTOMER_USER', 'customer_id': 5,
            'is_verified': True, 'is_active': True
        })
        
        obj = Mock()
        obj.customer_id = 5
        
        assert permission.has_object_permission(request, None, obj) is True
    
    def test_customer_user_cannot_access_other_customer_object(self):
        """Test that customer users cannot access other customer's objects."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'CUSTOMER_USER', 'customer_id': 5,
            'is_verified': True, 'is_active': True
        })
        
        obj = Mock()
        obj.customer_id = 10
        
        assert permission.has_object_permission(request, None, obj) is False
