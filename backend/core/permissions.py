"""
Custom permission classes for FULFILinator.

Implements role-based access control (RBAC) using role_level from USERinator:
- ADMIN (role_level >= 100): full access across all companies
- MANAGER/MEMBER: access only their company's data
"""
from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Permission class that allows access only to admins (role_level >= 100).
    Uses role_level from USERinator context.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and is an admin."""
        if not request.user or not hasattr(request.user, 'is_authenticated'):
            return False
        if not request.user.is_authenticated:
            return False
        role_level = getattr(request.user, 'role_level', 0)
        return role_level >= 100


class AdminOnly(permissions.BasePermission):
    """Alias for IsAdmin - requires ADMIN role (level 100)."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role_level = getattr(request.user, 'role_level', 0)
        return role_level >= 100


# Legacy aliases
IsSystemAdmin = IsAdmin
IsSystemAdminOrCustomerAdmin = IsAdmin


class CustomerDataIsolation(permissions.BasePermission):
    """
    Permission class that ensures company data isolation.
    
    - ADMIN (role_level >= 100) can access all data
    - Others can only access their company's data
    
    This is typically used at the queryset level via view filtering,
    but can also be used for object-level permissions.
    
    Note: Uses company_id_remote from USERinator context.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and has a company."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        role_level = getattr(request.user, 'role_level', 0)
        
        # ADMIN can access all data
        if role_level >= 100:
            return True
        
        # Users must have a company_id_remote
        company_id = getattr(request.user, 'company_id_remote', None)
        return company_id is not None
    
    def has_object_permission(self, request, view, obj):
        """Check if user can access this specific object."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        role_level = getattr(request.user, 'role_level', 0)
        
        # ADMIN has full access
        if role_level >= 100:
            return True
        
        # Check if object belongs to user's company
        user_company = getattr(request.user, 'company_id_remote', None)
        if hasattr(obj, 'company_id'):
            return obj.company_id == user_company
        # Legacy support for customer_id
        elif hasattr(obj, 'customer_id'):
            return obj.customer_id == user_company
        
        return False
