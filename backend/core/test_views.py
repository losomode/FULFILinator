"""
Tests for core views.
"""
import pytest
from django.test import Client


@pytest.mark.django_db
class TestHealthCheck:
    """Test suite for health check endpoint."""
    
    def test_health_check_returns_200(self):
        """Test health check endpoint returns 200 OK."""
        client = Client()
        response = client.get('/api/fulfil/health/')
        
        assert response.status_code == 200
    
    def test_health_check_returns_correct_data(self):
        """Test health check endpoint returns correct service info."""
        client = Client()
        response = client.get('/api/fulfil/health/')
        
        data = response.json()
        assert data['status'] == 'ok'
        assert data['service'] == 'FULFILinator'
        assert 'version' in data
    
    def test_health_check_does_not_require_auth(self):
        """Test health check endpoint does not require authentication."""
        client = Client()
        response = client.get('/api/fulfil/health/')
        
        # Should return 200 even without authentication
        assert response.status_code == 200
