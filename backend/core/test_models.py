"""
Tests for core models.
Following TDD - write tests before implementation.
"""
import pytest
import os
from io import BytesIO
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from core.models import Attachment


@pytest.mark.django_db
class TestAttachmentModel:
    """Test suite for Attachment model."""
    
    def test_create_attachment_for_po(self):
        """Test creating an attachment for a Purchase Order."""
        file_content = b'Test PDF content'
        uploaded_file = SimpleUploadedFile("test_po.pdf", file_content, content_type="application/pdf")
        
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=uploaded_file,
            filename='test_po.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        assert attachment.id is not None
        assert attachment.content_type == 'PO'
        assert attachment.object_id == 1
        assert attachment.filename == 'test_po.pdf'
        assert attachment.file_size == len(file_content)
        assert attachment.uploaded_by_user_id == 'user-123'
        assert attachment.uploaded_at is not None
    
    def test_create_attachment_for_order(self):
        """Test creating an attachment for an Order."""
        file_content = b'Test image content'
        uploaded_file = SimpleUploadedFile("invoice.png", file_content, content_type="image/png")
        
        attachment = Attachment.objects.create(
            content_type='ORDER',
            object_id=5,
            file=uploaded_file,
            filename='invoice.png',
            file_size=len(file_content),
            uploaded_by_user_id='user-456'
        )
        
        assert attachment.content_type == 'ORDER'
        assert attachment.object_id == 5
    
    def test_create_attachment_for_delivery(self):
        """Test creating an attachment for a Delivery."""
        file_content = b'Test Excel content'
        uploaded_file = SimpleUploadedFile("packing_list.xlsx", file_content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        
        attachment = Attachment.objects.create(
            content_type='DELIVERY',
            object_id=10,
            file=uploaded_file,
            filename='packing_list.xlsx',
            file_size=len(file_content),
            uploaded_by_user_id='user-789'
        )
        
        assert attachment.content_type == 'DELIVERY'
        assert attachment.object_id == 10
    
    def test_attachment_string_representation(self):
        """Test attachment's string representation."""
        file_content = b'Test content'
        uploaded_file = SimpleUploadedFile("doc.pdf", file_content, content_type="application/pdf")
        
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=uploaded_file,
            filename='doc.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        assert str(attachment) == "doc.pdf (PO-1)"
    
    def test_attachment_file_extension_property(self):
        """Test file_extension property."""
        file_content = b'Test content'
        uploaded_file = SimpleUploadedFile("document.PDF", file_content, content_type="application/pdf")
        
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=uploaded_file,
            filename='document.PDF',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        assert attachment.file_extension == 'pdf'  # Should be lowercase
    
    def test_attachment_file_size_mb_property(self):
        """Test file_size_mb property."""
        file_size = 5 * 1024 * 1024  # 5 MB
        file_content = b'x' * file_size
        uploaded_file = SimpleUploadedFile("large.pdf", file_content, content_type="application/pdf")
        
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=uploaded_file,
            filename='large.pdf',
            file_size=file_size,
            uploaded_by_user_id='user-123'
        )
        
        assert attachment.file_size_mb == 5.0
    
    def test_attachment_is_image_property(self):
        """Test is_image property for various file types."""
        test_cases = [
            ('image.png', True),
            ('photo.jpg', True),
            ('pic.jpeg', True),
            ('graphic.gif', True),
            ('bitmap.bmp', True),
            ('document.pdf', False),
            ('spreadsheet.xlsx', False),
        ]
        
        for filename, expected in test_cases:
            file_content = b'Test content'
            uploaded_file = SimpleUploadedFile(filename, file_content)
            
            attachment = Attachment.objects.create(
                content_type='PO',
                object_id=1,
                file=uploaded_file,
                filename=filename,
                file_size=len(file_content),
                uploaded_by_user_id='user-123'
            )
            
            assert attachment.is_image == expected, f"Failed for {filename}"
            attachment.delete()  # Clean up
    
    def test_attachment_is_pdf_property(self):
        """Test is_pdf property."""
        file_content = b'Test content'
        
        pdf_file = SimpleUploadedFile("document.pdf", file_content)
        pdf_attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=pdf_file,
            filename='document.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        assert pdf_attachment.is_pdf is True
        
        png_file = SimpleUploadedFile("image.png", file_content)
        png_attachment = Attachment.objects.create(
            content_type='PO',
            object_id=2,
            file=png_file,
            filename='image.png',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        assert png_attachment.is_pdf is False
    
    def test_attachment_is_spreadsheet_property(self):
        """Test is_spreadsheet property."""
        test_cases = [
            ('data.xlsx', True),
            ('data.xls', True),
            ('data.csv', True),
            ('document.pdf', False),
            ('image.png', False),
        ]
        
        for filename, expected in test_cases:
            file_content = b'Test content'
            uploaded_file = SimpleUploadedFile(filename, file_content)
            
            attachment = Attachment.objects.create(
                content_type='PO',
                object_id=1,
                file=uploaded_file,
                filename=filename,
                file_size=len(file_content),
                uploaded_by_user_id='user-123'
            )
            
            assert attachment.is_spreadsheet == expected, f"Failed for {filename}"
            attachment.delete()  # Clean up
    
    def test_attachment_auto_set_filename(self):
        """Test that filename is auto-set from file if not provided."""
        file_content = b'Test content'
        uploaded_file = SimpleUploadedFile("auto_name.pdf", file_content, content_type="application/pdf")
        
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=uploaded_file,
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
            # Note: filename not provided
        )
        
        assert attachment.filename == 'auto_name.pdf'
    
    def test_attachment_auto_set_file_size(self):
        """Test that file_size is auto-set from file if not provided."""
        file_content = b'Test content with known size'
        uploaded_file = SimpleUploadedFile("test.pdf", file_content, content_type="application/pdf")
        
        attachment = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=uploaded_file,
            filename='test.pdf',
            uploaded_by_user_id='user-123'
            # Note: file_size not provided
        )
        
        assert attachment.file_size == len(file_content)
    
    def test_attachment_rejects_oversized_file(self):
        """Test that oversized files are rejected."""
        # Create file larger than MAX_FILE_SIZE (10MB)
        oversized = 11 * 1024 * 1024
        # Don't actually create file content, just set size
        
        uploaded_file = SimpleUploadedFile("huge.pdf", b'x', content_type="application/pdf")
        
        with pytest.raises(ValueError, match="File size exceeds maximum"):
            Attachment.objects.create(
                content_type='PO',
                object_id=1,
                file=uploaded_file,
                filename='huge.pdf',
                file_size=oversized,  # Explicitly set oversized
                uploaded_by_user_id='user-123'
            )
    
    def test_attachment_ordering(self):
        """Test that attachments are ordered by uploaded_at descending."""
        file_content = b'Test content'
        
        # Create multiple attachments
        att1 = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("first.pdf", file_content),
            filename='first.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        att2 = Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("second.pdf", file_content),
            filename='second.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        # Query all attachments for this PO
        attachments = list(Attachment.objects.filter(content_type='PO', object_id=1))
        
        # Most recent should be first
        assert attachments[0].id == att2.id
        assert attachments[1].id == att1.id
    
    def test_query_attachments_by_entity(self):
        """Test querying attachments by content_type and object_id."""
        file_content = b'Test content'
        
        # Create attachments for different entities
        Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("po1_doc1.pdf", file_content),
            filename='po1_doc1.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        Attachment.objects.create(
            content_type='PO',
            object_id=1,
            file=SimpleUploadedFile("po1_doc2.pdf", file_content),
            filename='po1_doc2.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        Attachment.objects.create(
            content_type='PO',
            object_id=2,
            file=SimpleUploadedFile("po2_doc1.pdf", file_content),
            filename='po2_doc1.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        Attachment.objects.create(
            content_type='ORDER',
            object_id=1,
            file=SimpleUploadedFile("order1_doc1.pdf", file_content),
            filename='order1_doc1.pdf',
            file_size=len(file_content),
            uploaded_by_user_id='user-123'
        )
        
        # Query PO 1 attachments
        po1_attachments = Attachment.objects.filter(content_type='PO', object_id=1)
        assert po1_attachments.count() == 2
        
        # Query PO 2 attachments
        po2_attachments = Attachment.objects.filter(content_type='PO', object_id=2)
        assert po2_attachments.count() == 1
        
        # Query Order 1 attachments
        order1_attachments = Attachment.objects.filter(content_type='ORDER', object_id=1)
        assert order1_attachments.count() == 1
