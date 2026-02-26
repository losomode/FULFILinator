"""
Tests for AuthinatorClient.
Following Deft TDD - write tests before implementation.
"""
import pytest
from unittest.mock import patch, Mock
from core.authinator_client import AuthinatorClient


class TestAuthinatorClientGetCustomer:
    """Test suite for AuthinatorClient.get_customer method."""
    
    def setup_method(self):
        """Set up test client."""
        self.client = AuthinatorClient()
    
    @patch('core.authinator_client.requests.get')
    @patch('core.authinator_client.cache')
    def test_get_customer_success(self, mock_cache, mock_get):
        """Test successfully fetching customer data."""
        # No cache hit
        mock_cache.get.return_value = None
        
        # Mock successful API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'id': 'cust-123',
            'name': 'Acme Corporation',
            'contact_email': 'contact@acme.com',
        }
        mock_get.return_value = mock_response
        
        result = self.client.get_customer('cust-123')
        
        assert result is not None
        assert result['id'] == 'cust-123'
        assert result['name'] == 'Acme Corporation'
        assert result['contact_email'] == 'contact@acme.com'
        
        # Verify cache was set
        mock_cache.set.assert_called_once()
        cache_key = mock_cache.set.call_args[0][0]
        assert 'customer_cust-123' in cache_key
    
    @patch('core.authinator_client.requests.get')
    @patch('core.authinator_client.cache')
    def test_get_customer_from_cache(self, mock_cache, mock_get):
        """Test fetching customer data from cache."""
        # Cache hit
        cached_data = {
            'id': 'cust-456',
            'name': 'Tech Solutions Inc',
            'contact_email': 'info@techsolutions.com',
        }
        mock_cache.get.return_value = cached_data
        
        result = self.client.get_customer('cust-456')
        
        assert result == cached_data
        # API should not be called when cache hit
        mock_get.assert_not_called()
    
    @patch('core.authinator_client.requests.get')
    @patch('core.authinator_client.cache')
    def test_get_customer_not_found(self, mock_cache, mock_get):
        """Test fetching non-existent customer."""
        mock_cache.get.return_value = None
        
        # Mock 404 response
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        result = self.client.get_customer('cust-999')
        
        assert result is None
    
    @patch('core.authinator_client.requests.get')
    @patch('core.authinator_client.cache')
    def test_get_customer_api_error(self, mock_cache, mock_get):
        """Test handling API errors when fetching customer."""
        mock_cache.get.return_value = None
        
        # Mock API error
        mock_get.side_effect = Exception('Connection timeout')
        
        result = self.client.get_customer('cust-123')
        
        assert result is None
    
    @patch('core.authinator_client.requests.get')
    @patch('core.authinator_client.cache')
    def test_get_customer_caches_for_correct_duration(self, mock_cache, mock_get):
        """Test that customer data is cached for 1 hour."""
        mock_cache.get.return_value = None
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'id': 'cust-789',
            'name': 'Global Enterprises',
            'contact_email': 'contact@global.com',
        }
        mock_get.return_value = mock_response
        
        self.client.get_customer('cust-789')
        
        # Verify cache duration is 1 hour (3600 seconds)
        mock_cache.set.assert_called_once()
        cache_duration = mock_cache.set.call_args[0][2]
        assert cache_duration == 3600
    
    @patch('core.authinator_client.requests.get')
    @patch('core.authinator_client.cache')
    def test_get_customer_with_none_id(self, mock_cache, mock_get):
        """Test that None customer_id returns None without API call."""
        result = self.client.get_customer(None)
        
        assert result is None
        mock_get.assert_not_called()
        mock_cache.get.assert_not_called()
    
    @patch('core.authinator_client.requests.get')
    @patch('core.authinator_client.cache')
    def test_get_customer_with_empty_string(self, mock_cache, mock_get):
        """Test that empty string customer_id returns None without API call."""
        result = self.client.get_customer('')
        
        assert result is None
        mock_get.assert_not_called()
        mock_cache.get.assert_not_called()
