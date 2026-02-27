"""
Tests for permission classes.

Following Deft TDD principles.
"""
import pytest
from unittest.mock import Mock
from core.permissions import IsAdmin, CustomerDataIsolation
from core.authentication import AuthinatorUser


class TestIsAdmin:
    """Test suite for IsAdmin permission."""
    
    def test_allows_admin(self):
        """Test that admins are allowed."""
        permission = IsAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'ADMIN', 'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_denies_user(self):
        """Test that regular users are denied."""
        permission = IsAdmin()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'USER', 'customer_id': 1,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is False
    
    def test_denies_unauthenticated(self):
        """Test that unauthenticated users are denied."""
        permission = IsAdmin()
        request = Mock()
        request.user = None
        
        assert permission.has_permission(request, None) is False


class TestCustomerDataIsolation:
    """Test suite for CustomerDataIsolation permission."""
    
    def test_allows_system_admin(self):
        """Test that system admins pass permission check."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'ADMIN', 'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_allows_customer_user_with_customer_id(self):
        """Test that customer users with customer_id pass permission check."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'user', 'email': 'user@test.com',
            'role': 'USER', 'customer_id': 5,
            'is_verified': True, 'is_active': True
        })
        
        assert permission.has_permission(request, None) is True
    
    def test_system_admin_can_access_any_object(self):
        """Test that system admins can access any object."""
        permission = CustomerDataIsolation()
        request = Mock()
        request.user = AuthinatorUser({
            'id': 1, 'username': 'admin', 'email': 'admin@test.com',
            'role': 'ADMIN', 'is_verified': True, 'is_active': True
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
            'role': 'USER', 'customer_id': 5,
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
            'role': 'USER', 'customer_id': 5,
            'is_verified': True, 'is_active': True
        })
        
        obj = Mock()
        obj.customer_id = 10
        
        assert permission.has_object_permission(request, None, obj) is False
