"""
Custom permission classes for FULFILinator.

Implements role-based access control (RBAC) for:
- System Admins (full access)
- Customer Admins (manage their customer's data)
- Customer Users (view and edit their customer's data)
- Customer Read-Only (view only their customer's data)
"""
from rest_framework import permissions


class IsSystemAdmin(permissions.BasePermission):
    """
    Permission class that allows access only to system admins.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and is a system admin."""
        if not request.user or not hasattr(request.user, 'is_authenticated'):
            return False
        return (
            request.user.is_authenticated and 
            request.user.is_system_admin()
        )


class IsSystemAdminOrCustomerAdmin(permissions.BasePermission):
    """
    Permission class that allows access to system admins and customer admins.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and has admin role."""
        if not request.user or not hasattr(request.user, 'is_authenticated'):
            return False
        return (
            request.user.is_authenticated and 
            (request.user.is_system_admin() or request.user.is_customer_admin())
        )


class CanEditData(permissions.BasePermission):
    """
    Permission class that allows edit access to non-read-only users.
    Read-only users are denied access to unsafe methods (POST, PUT, PATCH, DELETE).
    """
    
    def has_permission(self, request, view):
        """Check if user can edit data."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Allow all authenticated users for safe methods (GET, HEAD, OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # For unsafe methods, check if user can edit data
        return request.user.can_edit_data()


class IsOwnerOrSystemAdmin(permissions.BasePermission):
    """
    Permission class that allows access to:
    - System admins (full access)
    - Users from the same customer (for their own data)
    
    This permission requires the object to have a 'customer_id' attribute.
    """
    
    def has_object_permission(self, request, view, obj):
        """Check if user can access this specific object."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # System admins have full access
        if request.user.is_system_admin():
            return True
        
        # Check if object belongs to user's customer
        # Object should have customer_id attribute
        if hasattr(obj, 'customer_id'):
            return obj.customer_id == request.user.customer_id
        
        return False


class CustomerDataIsolation(permissions.BasePermission):
    """
    Permission class that ensures customer data isolation.
    
    - System admins can access all data
    - Customer users can only access their customer's data
    
    This is typically used at the queryset level via view filtering,
    but can also be used for object-level permissions.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and has a customer."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # System admins can access all data
        if request.user.is_system_admin():
            return True
        
        # Customer users must have a customer_id
        return request.user.customer_id is not None
    
    def has_object_permission(self, request, view, obj):
        """Check if user can access this specific object."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # System admins have full access
        if request.user.is_system_admin():
            return True
        
        # Check if object belongs to user's customer
        if hasattr(obj, 'customer_id'):
            return obj.customer_id == request.user.customer_id
        
        return False
