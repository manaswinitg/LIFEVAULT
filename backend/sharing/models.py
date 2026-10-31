import uuid
import hashlib
from django.db import models
from django.conf import settings
from documents.models import Document

class ShareGrant(models.Model):
    PERMISSIONS = (
        ('view', 'View / Read-Only'),
        ('download', 'View & Download'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='share_grants')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_shares')
    shared_with = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='received_shares')
    
    # For link sharing: SHA-256 hash of the cryptographically random token
    token_hash = models.CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)
    permission = models.CharField(max_length=20, choices=PERMISSIONS, default='view')
    
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    max_downloads = models.PositiveIntegerField(null=True, blank=True) # e.g. 1 for one-time
    download_count = models.PositiveIntegerField(default=0)
    
    is_revoked = models.BooleanField(default=False, db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def hash_token(cls, raw_token: str) -> str:
        return hashlib.sha256(raw_token.strip().encode('utf-8')).hexdigest()

    def is_valid(self) -> tuple[bool, str]:
        from datetime import datetime, timezone
        if self.is_revoked:
            return False, "This share link has been revoked."
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False, "This share link has expired."
        if self.max_downloads and self.download_count >= self.max_downloads:
            return False, "Maximum permitted download limit has been reached."
        if self.document.is_deleted:
            return False, "The shared document is no longer available."
        return True, ""

    def __str__(self):
        target = self.shared_with.email if self.shared_with else "Link"
        return f"Share [{self.permission}] of '{self.document.title}' to {target}"


class ShareAccessLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share_grant = models.ForeignKey(ShareGrant, on_delete=models.CASCADE, related_name='access_logs')
    accessed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    action = models.CharField(max_length=20) # view, download
    success = models.BooleanField(default=True)
    accessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-accessed_at']

    def __str__(self):
        return f"{self.action} on {self.share_grant.document.title} at {self.accessed_at}"
