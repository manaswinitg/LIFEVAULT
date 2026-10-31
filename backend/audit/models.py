import uuid
from django.db import models
from django.conf import settings

class AuditEvent(models.Model):
    """
    Append-only tamper-evident audit log.
    Every event stores a SHA-256 cryptographic hash chaining to the previous event.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events'
    )
    action = models.CharField(max_length=100, db_index=True)
    target_type = models.CharField(max_length=50, blank=True, db_index=True)
    target_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    prev_hash = models.CharField(max_length=64, default='')
    current_hash = models.CharField(max_length=64, default='')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['actor', 'action']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        actor_email = self.actor.email if self.actor else "Anonymous"
        return f"[{self.timestamp}] {actor_email} - {self.action}"
