import uuid
from django.db import models
from django.conf import settings
from documents.models import Document

class DocumentReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='reminders')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reminders')
    reminder_days_before = models.PositiveIntegerField(default=30) # e.g. 30, 7, 1
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['document__expiry_date']
        unique_together = ('document', 'user', 'reminder_days_before')

    def __str__(self):
        return f"Reminder ({self.reminder_days_before}d) for {self.document.title}"


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('expiry', 'Document Expiry'),
        ('share', 'Document Sharing'),
        ('emergency', 'Emergency Access'),
        ('security', 'Security Alert'),
        ('system', 'System Notice'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    document = models.ForeignKey(Document, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='expiry')
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    deduplication_key = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} -> {self.user.email}"
