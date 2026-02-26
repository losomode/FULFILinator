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


class AdminOverride(models.Model):
    """
    Log of all admin override actions.
    
    Tracks when admins bypass normal validation rules,
    including who did it, why, and what entity was affected.
    """
    
    ENTITY_TYPE_CHOICES = [
        ('PO', 'Purchase Order'),
        ('ORDER', 'Order'),
        ('DELIVERY', 'Delivery'),
    ]
    
    OVERRIDE_TYPE_CHOICES = [
        ('CLOSE', 'Force Close'),
        ('WAIVE', 'Waive Quantity'),
        ('PRICE', 'Price Override'),
        ('ALLOCATION', 'Allocation Override'),
        ('OTHER', 'Other'),
    ]
    
    entity_type = models.CharField(
        max_length=20,
        choices=ENTITY_TYPE_CHOICES,
        help_text="Type of entity that was overridden"
    )
    entity_id = models.IntegerField(
        help_text="ID of the PO/Order/Delivery"
    )
    entity_number = models.CharField(
        max_length=50,
        help_text="PO/Order/Delivery number for easy reference"
    )
    override_type = models.CharField(
        max_length=20,
        choices=OVERRIDE_TYPE_CHOICES,
        help_text="Type of override performed"
    )
    reason = models.TextField(
        help_text="Reason provided by admin for the override"
    )
    user_id = models.CharField(
        max_length=255,
        help_text="ID of admin user who performed the override (from Authinator)"
    )
    user_email = models.EmailField(
        help_text="Email of admin user who performed the override",
        blank=True,
        default=''
    )
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional context about the override"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Admin Override'
        verbose_name_plural = 'Admin Overrides'
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['user_id']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        """String representation of override."""
        return f"{self.override_type} on {self.entity_type} {self.entity_number} by {self.user_id}"
