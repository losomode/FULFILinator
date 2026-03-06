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
