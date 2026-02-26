"""
Tests for Attachment serializer.
Following Deft TDD - write tests before implementation.
"""
import pytest
from io import BytesIO
from django.core.files.uploadedfile import SimpleUploadedFile
from core.models import Attachment
from core.serializers import AttachmentSerializer


@pytest.mark.django_db
class TestAttachmentSerializer:
    """Test suite for AttachmentSerializer."""
    
    def test_serialize_attachment(self):
        """Test serializing an Attachment instance."""
        file_content = b'Test PDF content'
        uploaded_file = SimpleUploadedFile("test.pdf", file_content, content_type="application/pdf")
        
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=uploaded_file,
            filename='test.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        serializer = AttachmentSerializer(attachment)
        data = serializer.data
        
        assert data['id'] == attachment.id
        assert data['content_type'] == 'PO'
        assert data['object_id'] == 1
        assert data['filename'] == 'test.pdf'
        assert data['file_size'] == len(file_content)
        assert data['uploaded_by_user_id'] == 'user-123'
        assert data['uploaded_at'] is not None
        assert 'file' in data  # Should include file URL
        
        # Check computed properties
        assert data['file_extension'] == 'pdf'
        assert data['file_size_mb'] == round(len(file_content) / (1024 * 1024), 2)
        assert data['is_image'] is False
        assert data['is_pdf'] is True
        assert data['is_spreadsheet'] is False
    
    def test_serialize_image_attachment(self):
        """Test serializing an image attachment with correct properties."""
        file_content = b'Test image content'
        uploaded_file = SimpleUploadedFile("photo.jpg", file_content, content_type="image/jpeg")
        
        attachment = Attachment.objects.create(
            content_type='ORDER',
            object_id=5,
            file=uploaded_file,
            filename='photo.jpg',
            file_size=len(file_content),
            uploaded_by_user_id='user-456'
        )
        
        serializer = AttachmentSerializer(attachment)
        data = serializer.data
        
        assert data['file_extension'] == 'jpg'
        assert data['is_image'] is True
        assert data['is_pdf'] is False
        assert data['is_spreadsheet'] is False
    
    def test_serialize_spreadsheet_attachment(self):
        """Test serializing a spreadsheet attachment with correct properties."""
        file_content = b'Test Excel content'
        uploaded_file = SimpleUploadedFile("data.xlsx", file_content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        
        attachment = Attachment.objects.create(
            content_type='DELIVERY',
            object_id=10,
            file=uploaded_file,
            filename='data.xlsx',
            file_size=len(file_content),
            uploaded_by_user_id='user-789'
        )
        
        serializer = AttachmentSerializer(attachment)
        data = serializer.data
        
        assert data['file_extension'] == 'xlsx'
        assert data['is_image'] is False
        assert data['is_pdf'] is False
        assert data['is_spreadsheet'] is True
    
    def test_deserialize_attachment_for_creation(self):
        """Test deserializing data to create a new Attachment."""
        file_content = b'New file content'
        uploaded_file = SimpleUploadedFile("new_doc.pdf", file_content, content_type="application/pdf")
        
        data = {
            'content_type': 'PO',
            'object_id': 2,
            'file': uploaded_file,
        }
        
        serializer = AttachmentSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        
        # uploaded_by_user_id must be provided when saving since it's required by model
        attachment = serializer.save(uploaded_by_user_id='user-999')
        
        assert attachment.content_type == 'PO'
        assert attachment.object_id == 2
        assert attachment.filename == 'new_doc.pdf'
        assert attachment.file_size == len(file_content)
        assert attachment.uploaded_by_user_id == 'user-999'
    
    def test_deserialize_without_required_fields(self):
        """Test deserializing without required fields returns validation errors."""
        data = {
            'object_id': 1,
            # Missing content_type, file (uploaded_by_user_id is set by view)
        }
        
        serializer = AttachmentSerializer(data=data)
        assert not serializer.is_valid()
        assert 'content_type' in serializer.errors
        assert 'file' in serializer.errors
    
    def test_deserialize_with_invalid_content_type(self):
        """Test deserializing with invalid content_type returns validation error."""
        file_content = b'Test content'
        uploaded_file = SimpleUploadedFile("test.pdf", file_content, content_type="application/pdf")
        
        data = {
            'content_type': 'INVALID_TYPE',
            'object_id': 1,
            'file': uploaded_file,
            'uploaded_by_user_id': 'user-123'
        }
        
        serializer = AttachmentSerializer(data=data)
        assert not serializer.is_valid()
        assert 'content_type' in serializer.errors
    
    def test_serialize_multiple_attachments(self):
        """Test serializing a queryset of attachments."""
        file_content = b'Test content'
        
        att1 = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("doc1.pdf", file_content),
            filename='doc1.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        att2 = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("doc2.pdf", file_content),
            filename='doc2.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        attachments = Attachment.objects.filter(content_type='PO', object_id=1)
        serializer = AttachmentSerializer(attachments, many=True)
        
        assert len(serializer.data) == 2
        assert serializer.data[0]['filename'] in ['doc1.pdf', 'doc2.pdf']
        assert serializer.data[1]['filename'] in ['doc1.pdf', 'doc2.pdf']
