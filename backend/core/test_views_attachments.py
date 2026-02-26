"""
Tests for Attachment API endpoints.
Following Deft TDD - write tests before implementation.
"""
import pytest
from unittest.mock import patch, Mock
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from core.models import Attachment
from core.authentication import AuthinatorUser


@pytest.fixture
def api_client():
    """Fixture for API client."""
    return APIClient()


@pytest.fixture
def system_admin_user():
    """Fixture for system admin user."""
    return AuthinatorUser({
        'id': '1',
        'username': 'admin',
        'email': 'admin@test.com',
        'role': 'SYSTEM_ADMIN',
        'customer_id': None,
        'customer_name': None,
        'is_verified': True,
        'is_active': True,
    })


@pytest.fixture
def customer_user():
    """Fixture for customer user."""
    return AuthinatorUser({
        'id': '2',
        'username': 'customer',
        'email': 'customer@test.com',
        'role': 'CUSTOMER_USER',
        'customer_id': 1,
        'customer_name': 'Test Corp',
        'is_verified': True,
        'is_active': True,
    })


def mock_auth(api_client, user):
    """Helper to mock authentication."""
    patcher = patch('core.authentication.AuthinatorJWTAuthentication.authenticate')
    mock = patcher.start()
    mock.return_value = (user, 'test-token')
    api_client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
    return patcher


@pytest.mark.django_db
class TestAttachmentListEndpoint:
    """Test suite for Attachment list endpoint."""
    
    def test_list_attachments_for_po(self, api_client, system_admin_user):
        """Test listing attachments for a specific PO."""
        patcher = mock_auth(api_client, system_admin_user)
        
        # Create test attachments
        file_content = b'Test content'
        Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("doc1.pdf", file_content),
            filename='doc1.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='1'
        )
        Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("doc2.pdf", file_content),
            filename='doc2.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='1'
        )
        Attachment.objects.create(
            content_type='PO',
            object_id=2,
            file=SimpleUploadedFile("other.pdf", file_content),
            filename='other.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='1'
        )
        
        response = api_client.get('/api/fulfil/attachments/?content_type=PO&object_id=1')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 2
        assert response.data['results'][0]['filename'] in ['doc1.pdf', 'doc2.pdf']
        
        patcher.stop()
    
    def test_list_attachments_for_order(self, api_client, system_admin_user):
        """Test listing attachments for a specific Order."""
        patcher = mock_auth(api_client, system_admin_user)
        
        file_content = b'Test content'
        Attachment.objects.create(
            content_type='ORDER',
            object_id=5,
            file=SimpleUploadedFile("invoice.pdf", file_content),
            filename='invoice.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='1'
        )
        
        response = api_client.get('/api/fulfil/attachments/?content_type=ORDER&object_id=5')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['filename'] == 'invoice.pdf'
        
        patcher.stop()
    
    def test_list_attachments_requires_auth(self, api_client):
        """Test listing attachments requires authentication."""
        response = api_client.get('/api/fulfil/attachments/')
        
        # DRF returns 403 Forbidden when IsAuthenticated permission is not met
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestAttachmentCreateEndpoint:
    """Test suite for Attachment create endpoint."""
    
    def test_create_attachment_for_po(self, api_client, system_admin_user):
        """Test creating an attachment for a PO."""
        patcher = mock_auth(api_client, system_admin_user)
        
        file_content = b'Test PDF content'
        uploaded_file = SimpleUploadedFile("new_doc.pdf", file_content, content_type="application/pdf")
        
        data = {
            'content_type': 'PO',
            'object_id': 1,
            'file': uploaded_file,
        }
        
        response = api_client.post('/api/fulfil/attachments/', data, format='multipart')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['filename'] == 'new_doc.pdf'
        assert response.data['content_type'] == 'PO'
        assert response.data['object_id'] == 1
        assert response.data['uploaded_by_user_id'] == '1'
        
        # Verify attachment was created in database
        attachment = Attachment.objects.get(id=response.data['id'])
        assert attachment.filename == 'new_doc.pdf'
        
        patcher.stop()
    
    def test_create_attachment_sets_uploaded_by_user(self, api_client, customer_user):
        """Test that uploaded_by_user_id is automatically set from authenticated user."""
        patcher = mock_auth(api_client, customer_user)
        
        file_content = b'Test content'
        uploaded_file = SimpleUploadedFile("test.png", file_content, content_type="image/png")
        
        data = {
            'content_type': 'ORDER',
            'object_id': 10,
            'file': uploaded_file,
        }
        
        response = api_client.post('/api/fulfil/attachments/', data, format='multipart')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['uploaded_by_user_id'] == '2'
        
        patcher.stop()
    
    def test_create_attachment_without_file(self, api_client, system_admin_user):
        """Test creating attachment without file returns validation error."""
        patcher = mock_auth(api_client, system_admin_user)
        
        data = {
            'content_type': 'PO',
            'object_id': 1,
        }
        
        response = api_client.post('/api/fulfil/attachments/', data, format='multipart')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'file' in response.data
        
        patcher.stop()
    
    def test_create_attachment_requires_auth(self, api_client):
        """Test creating attachment requires authentication."""
        file_content = b'Test content'
        uploaded_file = SimpleUploadedFile("test.pdf", file_content)
        
        data = {
            'content_type': 'PO',
            'object_id': 1,
            'file': uploaded_file,
        }
        
        response = api_client.post('/api/fulfil/attachments/', data, format='multipart')
        
        # DRF returns 403 Forbidden when IsAuthenticated permission is not met
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_create_attachment_with_invalid_extension(self, api_client, system_admin_user):
        """Test creating attachment with invalid file extension is rejected."""
        patcher = mock_auth(api_client, system_admin_user)
        
        file_content = b'Test content'
        uploaded_file = SimpleUploadedFile("malicious.exe", file_content)
        
        data = {
            'content_type': 'PO',
            'object_id': 1,
            'file': uploaded_file,
        }
        
        response = api_client.post('/api/fulfil/attachments/', data, format='multipart')
        
        # Should get validation error
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        
        patcher.stop()


@pytest.mark.django_db
class TestAttachmentRetrieveEndpoint:
    """Test suite for Attachment retrieve endpoint."""
    
    def test_retrieve_attachment(self, api_client, system_admin_user):
        """Test retrieving a single attachment by ID."""
        patcher = mock_auth(api_client, system_admin_user)
        
        file_content = b'Test content'
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("doc.pdf", file_content),
            filename='doc.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='1'
        )
        
        response = api_client.get(f'/api/fulfil/attachments/{attachment.id}/')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == attachment.id
        assert response.data['filename'] == 'doc.pdf'
        
        patcher.stop()
    
    def test_retrieve_nonexistent_attachment(self, api_client, system_admin_user):
        """Test retrieving nonexistent attachment returns 404."""
        patcher = mock_auth(api_client, system_admin_user)
        
        response = api_client.get('/api/fulfil/attachments/99999/')
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        patcher.stop()


@pytest.mark.django_db
class TestAttachmentDeleteEndpoint:
    """Test suite for Attachment delete endpoint."""
    
    def test_delete_attachment(self, api_client, system_admin_user):
        """Test deleting an attachment."""
        patcher = mock_auth(api_client, system_admin_user)
        
        file_content = b'Test content'
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("doc.pdf", file_content),
            filename='doc.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='1'
        )
        
        attachment_id = attachment.id
        
        response = api_client.delete(f'/api/fulfil/attachments/{attachment_id}/')
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify attachment was deleted
        assert not Attachment.objects.filter(id=attachment_id).exists()
        
        patcher.stop()
    
    def test_delete_attachment_requires_auth(self, api_client):
        """Test deleting attachment requires authentication."""
        file_content = b'Test content'
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("doc.pdf", file_content),
            filename='doc.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='1'
        )
        
        response = api_client.delete(f'/api/fulfil/attachments/{attachment.id}/')
        
        # DRF returns 403 Forbidden when IsAuthenticated permission is not met
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_customer_user_can_delete_own_attachment(self, api_client, customer_user):
        """Test customer user can delete their own attachment."""
        patcher = mock_auth(api_client, customer_user)
        
        file_content = b'Test content'
        attachment = Attachment.objects.create(
            content_type='ORDER',
            object_id=5,
            file=SimpleUploadedFile("doc.pdf", file_content),
            filename='doc.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='2'  # Same as customer_user id
        )
        
        response = api_client.delete(f'/api/fulfil/attachments/{attachment.id}/')
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        patcher.stop()
