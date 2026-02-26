"""
Custom authentication classes for FULFILinator.

Authenticates requests by validating JWT tokens with Authinator.
"""
from rest_framework import authentication
from rest_framework import exceptions
from core.authinator_client import authinator_client


class AuthinatorUser:
    """
    Simple user object to store information fetched from Authinator.
    This is not a Django model, just a container for user data.
    """
    
    def __init__(self, user_data):
        self.id = user_data['id']
        self.username = user_data['username']
        self.email = user_data['email']
        self.role = user_data['role']
        self.customer_id = user_data.get('customer_id')
        self.customer_name = user_data.get('customer_name')
        self.is_verified = user_data.get('is_verified', False)
        self.is_active = user_data.get('is_active', False)
        self.is_authenticated = True
    
    def is_system_admin(self):
        """Check if user is a system admin."""
        return self.role == 'SYSTEM_ADMIN'
    
    def is_customer_admin(self):
        """Check if user is a customer admin."""
        return self.role == 'CUSTOMER_ADMIN'
    
    def can_manage_users(self):
        """Check if user can manage other users."""
        return self.role in ['SYSTEM_ADMIN', 'CUSTOMER_ADMIN']
    
    def can_edit_data(self):
        """Check if user can edit data (not read-only)."""
        return self.role != 'CUSTOMER_READONLY'
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class AuthinatorJWTAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication class that validates JWT tokens with Authinator.
    
    This authentication class:
    1. Extracts the JWT token from the Authorization header
    2. Validates the token with Authinator API
    3. Returns an AuthinatorUser object with user information
    """
    
    def authenticate(self, request):
        """
        Authenticate the request and return a two-tuple of (user, token).
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header:
            return None
        
        # Parse Bearer token
        parts = auth_header.split()
        
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            raise exceptions.AuthenticationFailed('Invalid authorization header format')
        
        token = parts[1]
        
        # Validate token with Authinator
        user_data = authinator_client.get_user_from_token(token)
        
        if user_data is None:
            raise exceptions.AuthenticationFailed('Invalid or expired token')
        
        if not user_data.get('is_verified'):
            raise exceptions.AuthenticationFailed('User account is not verified')
        
        if not user_data.get('is_active'):
            raise exceptions.AuthenticationFailed('User account is not active')
        
        # Create user object
        user = AuthinatorUser(user_data)
        
        return (user, token)
