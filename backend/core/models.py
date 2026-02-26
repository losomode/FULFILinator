"""
Core models shared across FULFILinator apps.

Includes generic attachment support for POs, Orders, and Deliveries.
"""
from django.db import models
from django.core.validators import FileExtensionValidator
import os


class Attachment(models.Model):
    """
    Generic attachment model supporting multiple entity types.
    
    Can be attached to PurchaseOrders, Orders, or Deliveries using
    content_type and object_id fields.
    """
    
    CONTENT_TYPE_CHOICES = [
        ('PO', 'Purchase Order'),
        ('ORDER', 'Order'),
        ('DELIVERY', 'Delivery'),
    ]
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS = [
        'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp',
        'xlsx', 'xls', 'csv', 'doc', 'docx', 'txt'
    ]
    
    # Max file size: 10MB
    MAX_FILE_SIZE = 10 * 1024 * 1024
    
    content_type = models.CharField(
        max_length=20,
        choices=CONTENT_TYPE_CHOICES,
        help_text="Type of entity this attachment belongs to"
    )
    object_id = models.IntegerField(
        help_text="ID of the PO/Order/Delivery"
    )
    file = models.FileField(
        upload_to='attachments/%Y/%m/%d/',
        validators=[FileExtensionValidator(allowed_extensions=ALLOWED_EXTENSIONS)],
        help_text="Uploaded file"
    )
    filename = models.CharField(
        max_length=255,
        help_text="Original filename"
    )
    file_size = models.IntegerField(
        help_text="File size in bytes"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by_user_id = models.CharField(
        max_length=255,
        help_text="ID of user who uploaded this file (from Authinator)"
    )
    
    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Attachment'
        verbose_name_plural = 'Attachments'
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        """String representation of attachment."""
        return f"{self.filename} ({self.content_type}-{self.object_id})"
    
    def save(self, *args, **kwargs):
        """Override save to set filename and validate size."""
        if self.file:
            # Set filename if not already set
            if not self.filename:
                self.filename = os.path.basename(self.file.name)
            
            # Set file size
            if not self.file_size and hasattr(self.file, 'size'):
                self.file_size = self.file.size
            
            # Validate file size
            if self.file_size > self.MAX_FILE_SIZE:
                raise ValueError(f'File size exceeds maximum allowed size of {self.MAX_FILE_SIZE / (1024 * 1024)}MB')
        
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """Override delete to remove file from storage."""
        # Delete the file from storage
        if self.file:
            if os.path.isfile(self.file.path):
                os.remove(self.file.path)
        
        super().delete(*args, **kwargs)
    
    @property
    def file_extension(self):
        """Get file extension."""
        return os.path.splitext(self.filename)[1].lower().lstrip('.')
    
    @property
    def file_size_mb(self):
        """Get file size in MB."""
        return round(self.file_size / (1024 * 1024), 2)
    
    @property
    def is_image(self):
        """Check if file is an image."""
        return self.file_extension in ['png', 'jpg', 'jpeg', 'gif', 'bmp']
    
    @property
    def is_pdf(self):
        """Check if file is a PDF."""
        return self.file_extension == 'pdf'
    
    @property
    def is_spreadsheet(self):
        """Check if file is a spreadsheet."""
        return self.file_extension in ['xlsx', 'xls', 'csv']
