import uuid
from datetime import datetime, timezone, timedelta
from django.db import models
from django.conf import settings
from documents.models import Document

class TrustedContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trusted_contacts')
    contact_name = models.CharField(max_length=255)
    contact_email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    relationship = models.CharField(max_length=100, blank=True)
    is_verified = models.BooleanField(default=True) # Set true for local/immediate policy linking
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['contact_name']
        unique_together = ('owner', 'contact_email')

    def __str__(self):
        return f"{self.contact_name} ({self.contact_email}) for {self.owner.email}"


class EmergencyAccessPolicy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='emergency_policies')
    trusted_contact = models.ForeignKey(TrustedContact, on_delete=models.CASCADE, related_name='policies')
    waiting_period_hours = models.PositiveIntegerField(default=48) # Default 48h veto window
    can_access_all = models.BooleanField(default=False)
    specific_documents = models.ManyToManyField(Document, blank=True, related_name='emergency_policies')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Policy: {self.trusted_contact.contact_name} -> {self.owner.email} ({self.waiting_period_hours}h)"


class EmergencyAccessRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Owner Review / Waiting Period'),
        ('approved', 'Approved / Access Granted'),
        ('cancelled', 'Cancelled by Owner'),
        ('rejected', 'Rejected by Owner'),
        ('expired', 'Access Expired'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    policy = models.ForeignKey(EmergencyAccessPolicy, on_delete=models.CASCADE, related_name='requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    trigger_reason = models.TextField()
    
    requested_at = models.DateTimeField(auto_now_add=True)
    cancellation_deadline = models.DateTimeField()
    approved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-requested_at']

    def check_and_apply_maturity(self):
        """
        If waiting period has elapsed and request was not cancelled, transitions to approved.
        """
        if self.status == 'pending':
            now = datetime.now(timezone.utc)
            if now >= self.cancellation_deadline:
                self.status = 'approved'
                self.approved_at = now
                self.expires_at = now + timedelta(days=7) # 7-day access window
                self.save(update_fields=['status', 'approved_at', 'expires_at'])

    def __str__(self):
        return f"Emergency Request [{self.status}] by {self.policy.trusted_contact.contact_email}"
