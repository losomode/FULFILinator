"""
Custom permission classes for FULFILinator.

Implements role-based access control (RBAC):
- Admins (full access)
- Users (access their customer's data)
"""
from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Permission class that allows access only to admins.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and is an admin."""
        if not request.user or not hasattr(request.user, 'is_authenticated'):
            return False
        return (
            request.user.is_authenticated and 
            request.user.is_admin
        )


# Legacy aliases
IsSystemAdmin = IsAdmin
IsSystemAdminOrCustomerAdmin = IsAdmin


class CustomerDataIsolation(permissions.BasePermission):
    """
    Permission class that ensures customer data isolation.
    
    - Admins can access all data
    - Users can only access their customer's data
    
    This is typically used at the queryset level via view filtering,
    but can also be used for object-level permissions.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and has a customer."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins can access all data
        if request.user.is_admin:
            return True
        
        # Users must have a customer_id
        return request.user.customer_id is not None
    
    def has_object_permission(self, request, view, obj):
        """Check if user can access this specific object."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins have full access
        if request.user.is_admin:
            return True
        
        # Check if object belongs to user's customer
        if hasattr(obj, 'customer_id'):
            return obj.customer_id == request.user.customer_id
        
        return False
