"""
Custom authentication classes for FULFILinator.

Authenticates requests by validating JWT tokens with Authinator.
"""
import logging
from rest_framework import authentication
from rest_framework import exceptions
from core.authinator_client import authinator_client
from core.userinator_client import userinator_client

logger = logging.getLogger(__name__)


class AuthinatorUser:
    """
    Simple user object to store information fetched from Authinator.
    This is not a Django model, just a container for user data.

    Supports both legacy role strings ('ADMIN'/'USER') and the newer
    role_level system from USERinator-enriched JWTs.
    """
    
    def __init__(self, user_data, context_data=None):
        self.id = user_data['id']
        self.username = user_data['username']
        self.email = user_data['email']
        
        # Prefer USERinator context data over AUTHinator data
        if context_data:
            self.role = context_data.get('role_name', '')
            self.role_level = context_data.get('role_level', 0)
            self.customer_id = context_data.get('company_id')  # USERinator uses company_id
            self.company_id_remote = context_data.get('company_id')
            self.customer_name = context_data.get('company_name')
        else:
            self.role = user_data['role']
            self.role_level = user_data.get('role_level', 0)
            self.customer_id = user_data.get('customer_id')
            self.company_id_remote = user_data.get('customer_id')
            self.customer_name = user_data.get('customer_name')
        
        self.is_verified = user_data.get('is_verified', False)
        self.is_active = user_data.get('is_active', False)
        self.is_authenticated = True
    
    @property
    def is_admin(self):
        """Check if user is an admin.

        Uses role_level when available (from USERinator-enriched JWT),
        falls back to legacy Authinator role names.
        """
        if self.role_level:
            return self.role_level >= 100
        return self.role in ('ADMIN', 'SYSTEM_ADMIN', 'CUSTOMER_ADMIN')
    
    # Legacy aliases
    def is_system_admin(self):
        return self.is_admin
    
    def is_customer_admin(self):
        return self.is_admin
    
    def can_manage_users(self):
        return self.is_admin
    
    def can_edit_data(self):
        return True
    
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
        
        # Fetch full context from USERinator (role_level, company, permissions)
        user_id = user_data.get('id')
        context_data = None
        if user_id:
            context_data = userinator_client.get_user_context(user_id, token)
            if not context_data:
                logger.warning(
                    f'Failed to fetch USERinator context for user {user_id}, '
                    'falling back to AUTHinator data'
                )
        
        # Create user object with USERinator context
        user = AuthinatorUser(user_data, context_data)
        
        return (user, token)
