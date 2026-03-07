"""
Client for communicating with USERinator service.

Fetches user profile data (display_name, avatar, company, etc.)
for display in FULFILinator views.
"""
import logging

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class UserinatorClient:
    """Client for querying USERinator API."""

    CACHE_TTL = 300  # 5 minutes

    def __init__(self):
        self.api_url = settings.USERINATOR_API_URL
        self.service_key = settings.USERINATOR_SERVICE_KEY

    def get_user_context(self, user_id, token=None):
        """
        Fetch full user context including role_level, company, and permissions.
        
        Args:
            user_id: User ID to fetch context for
            token: Bearer token for authorization (optional, will use service key if not provided)
        
        Returns:
            dict with context data including role_level, company_id, permissions, or None.
        """
        cache_key = f"userinator_context_{user_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        headers = {"X-Service-Key": self.service_key}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            response = requests.get(
                f"{self.api_url}{user_id}/context/",
                headers=headers,
                timeout=3,
            )
            
            if response.status_code == 200:
                data = response.json()
                cache.set(cache_key, data, self.CACHE_TTL)
                return data
            
            logger.info(
                "USERinator context fetch for user %s returned %s",
                user_id, response.status_code,
            )
        except requests.RequestException as exc:
            logger.warning("USERinator unreachable for context %s: %s", user_id, exc)
        
        return None

    def get_user_profile(self, user_id):
        """
        Fetch profile data for a user from USERinator.

        Returns:
            dict with profile data, or None if unavailable.
        """
        cache_key = f"userinator_profile_{user_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            response = requests.get(
                f"{self.api_url}{user_id}/",
                headers={"X-Service-Key": self.service_key},
                timeout=3,
            )

            if response.status_code == 200:
                data = response.json()
                cache.set(cache_key, data, self.CACHE_TTL)
                return data

            logger.info(
                "USERinator profile fetch for user %s returned %s",
                user_id, response.status_code,
            )
        except requests.RequestException as exc:
            logger.warning("USERinator unreachable for profile %s: %s", user_id, exc)

        return None

    def get_company(self, company_id):
        """
        Fetch company data from USERinator.
        
        Args:
            company_id: Company ID to fetch (can be string or int)
        
        Returns:
            dict with company data (id, name), or None if unavailable.
        """
        if not company_id:
            return None
        
        # Normalize to int for cache key
        try:
            company_id_int = int(company_id)
        except (ValueError, TypeError):
            logger.warning("Invalid company_id: %s", company_id)
            return None
        
        cache_key = f"userinator_company_{company_id_int}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        try:
            # USERinator companies endpoint is /api/companies/{id}/
            company_url = settings.USERINATOR_API_URL.replace("/api/users/", "/api/companies/")
            response = requests.get(
                f"{company_url}{company_id_int}/",
                headers={"X-Service-Key": self.service_key},
                timeout=3,
            )
            
            if response.status_code == 200:
                data = response.json()
                # Cache for 1 hour (companies change less frequently)
                cache.set(cache_key, data, 3600)
                return data
            
            logger.info(
                "USERinator company fetch for %s returned %s",
                company_id, response.status_code,
            )
        except requests.RequestException as exc:
            logger.warning("USERinator unreachable for company %s: %s", company_id, exc)
        
        return None

    def get_profiles_batch(self, user_ids, token=None):
        """
        Fetch profiles for multiple users via USERinator /batch/ endpoint.

        Args:
            user_ids: list of user IDs to fetch
            token: Bearer token to forward for auth

        Returns:
            list of profile dicts, or empty list on failure.
        """
        if not user_ids:
            return []

        headers = {"X-Service-Key": self.service_key}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            response = requests.post(
                f"{self.api_url}batch/",
                json={"user_ids": list(user_ids)},
                headers=headers,
                timeout=5,
            )

            if response.status_code == 200:
                return response.json()
        except requests.RequestException as exc:
            logger.warning("USERinator batch fetch failed: %s", exc)

        return []


# Singleton instance
userinator_client = UserinatorClient()
