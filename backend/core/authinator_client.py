"""
Client for communicating with Authinator service.

This module provides utilities to validate JWT tokens and fetch
user/customer information from the Authinator service.
"""
import requests
from django.conf import settings
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


class AuthinatorClient:
    """Client for interacting with Authinator API."""
    
    def __init__(self):
        self.api_url = settings.AUTHINATOR_API_URL
        self.verify_ssl = settings.AUTHINATOR_VERIFY_SSL
    
    def get_user_from_token(self, token):
        """
        Validate JWT token and retrieve user information from Authinator.
        
        Args:
            token (str): JWT access token
        
        Returns:
            dict: User information including id, username, email, role, customer_id
            None: If token is invalid or request fails
        """
        # Check cache first (cache for 5 minutes)
        cache_key = f'authinator_user_{token[:20]}'
        cached_user = cache.get(cache_key)
        if cached_user:
            return cached_user
        
        try:
            response = requests.get(
                f'{self.api_url}me/',
                headers={'Authorization': f'Bearer {token}'},
                verify=self.verify_ssl,
                timeout=5
            )
            
            if response.status_code == 200:
                user_data = response.json()
                
                # Transform to expected format
                user_info = {
                    'id': user_data.get('id'),
                    'username': user_data.get('username'),
                    'email': user_data.get('email'),
                    'role': user_data.get('role'),
                    'customer_id': user_data.get('customer', {}).get('id') if user_data.get('customer') else None,
                    'customer_name': user_data.get('customer', {}).get('name') if user_data.get('customer') else None,
                    'is_verified': user_data.get('is_verified', False),
                    'is_active': user_data.get('is_active', False),
                }
                
                # Cache the result
                cache.set(cache_key, user_info, 300)  # 5 minutes
                
                return user_info
            else:
                logger.warning(f'Failed to validate token with Authinator: {response.status_code}')
                return None
                
        except requests.RequestException as e:
            logger.error(f'Error connecting to Authinator: {e}')
            return None
    
    def verify_token(self, token):
        """
        Verify if a JWT token is valid.
        
        Args:
            token (str): JWT access token
        
        Returns:
            bool: True if token is valid, False otherwise
        """
        user = self.get_user_from_token(token)
        return user is not None
    
    def get_customer(self, customer_id):
        """
        Fetch customer information from Authinator.
        
        Args:
            customer_id (str): Customer ID
        
        Returns:
            dict: Customer information including id, name, contact_email
            None: If customer not found or request fails
        """
        # Return None for empty/None customer_id
        if not customer_id:
            return None
        
        # Check cache first (cache for 1 hour)
        cache_key = f'authinator_customer_{customer_id}'
        cached_customer = cache.get(cache_key)
        if cached_customer:
            return cached_customer
        
        try:
            response = requests.get(
                f'{self.api_url}customers/{customer_id}/',
                verify=self.verify_ssl,
                timeout=5
            )
            
            if response.status_code == 200:
                customer_data = response.json()
                
                # Cache the result for 1 hour
                cache.set(cache_key, customer_data, 3600)
                
                return customer_data
            else:
                logger.warning(f'Failed to fetch customer {customer_id} from Authinator: {response.status_code}')
                return None
                
        except Exception as e:
            logger.error(f'Error fetching customer from Authinator: {e}')
            return None


# Singleton instance
authinator_client = AuthinatorClient()
