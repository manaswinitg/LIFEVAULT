import uuid
from django.db import models
from django.conf import settings

class DocumentCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, default='folder')
    is_system = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Document Categories'
        ordering = ['display_name']

    def __str__(self):
        return self.display_name


class DocumentTag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=20, default='blue')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('user', 'name')

    def __str__(self):
        return f"#{self.name}"


class StorageObject(models.Model):
    """
    Physical encrypted storage artifact representation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    storage_path = models.CharField(max_length=500, unique=True)
    file_size = models.BigIntegerField()
    sha256_hash = models.CharField(max_length=64, db_index=True)
    mime_type = models.CharField(max_length=100)
    encryption_nonce = models.CharField(max_length=64)
    encryption_algorithm = models.CharField(max_length=50, default='AES-256-GCM')
    is_encrypted = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"StorageObject {self.id} ({self.file_size} bytes)"


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='documents')
    category = models.ForeignKey(DocumentCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    current_storage_object = models.ForeignKey(StorageObject, on_delete=models.SET_NULL, null=True, blank=True, related_name='active_documents')
    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    current_version = models.PositiveIntegerField(default=1)
    
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    issuer = models.CharField(max_length=255, blank=True)
    reference_number = models.CharField(max_length=100, blank=True) # Sensitive record identifier

    tags = models.ManyToManyField(DocumentTag, blank=True, related_name='documents')
    
    is_archived = models.BooleanField(default=False, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['owner', 'is_deleted', 'is_archived']),
            models.Index(fields=['owner', 'expiry_date']),
        ]

    def __str__(self):
        return f"{self.title} ({self.owner.email})"


class DocumentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    storage_object = models.ForeignKey(StorageObject, on_delete=models.CASCADE, related_name='version_records')
    version_number = models.PositiveIntegerField()
    version_notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    file_size = models.BigIntegerField()
    sha256_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version_number']
        unique_together = ('document', 'version_number')

    def __str__(self):
        return f"{self.document.title} v{self.version_number}"
