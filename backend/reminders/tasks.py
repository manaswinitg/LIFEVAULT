from datetime import date, timedelta
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError
from documents.models import Document
from .models import DocumentReminder, Notification

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def check_document_expiries(self):
    """
    Periodic job that monitors document expiry dates and dispatches idempotent alerts.
    Prevents duplicate notifications through unique deduplication keys.
    """
    today = date.today()
    reminder_thresholds = [30, 7, 1, 0] # 30 days, 7 days, 1 day, and on expiry day
    created_count = 0

    active_docs = Document.objects.filter(
        is_deleted=False,
        is_archived=False,
        expiry_date__isnull=False
    ).select_related('owner', 'owner__profile')

    for doc in active_docs:
        days_remaining = (doc.expiry_date - today).days
        if days_remaining in reminder_thresholds:
            # Construct deterministic deduplication key
            dedup_key = f"expiry:{doc.id}:{days_remaining}:{today.isoformat()}"
            
            if Notification.objects.filter(deduplication_key=dedup_key).exists():
                continue

            if days_remaining == 0:
                title = f"Action Required: '{doc.title}' expires today!"
                msg = f"Your document '{doc.title}' ({doc.original_filename}) expires today, {doc.expiry_date}. Please take necessary action."
            else:
                title = f"Document Expiry Notice: '{doc.title}' expires in {days_remaining} days"
                msg = f"Your document '{doc.title}' ({doc.original_filename}) is scheduled to expire on {doc.expiry_date} ({days_remaining} days remaining)."

            try:
                Notification.objects.create(
                    user=doc.owner,
                    document=doc,
                    title=title,
                    message=msg,
                    notification_type='expiry',
                    deduplication_key=dedup_key
                )
                created_count += 1

                # Send email if enabled in user profile
                if hasattr(doc.owner, 'profile') and doc.owner.profile.notification_email_enabled:
                    send_mail(
                        subject=f"LifeVault Alert: {title}",
                        message=msg,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[doc.owner.email],
                        fail_silently=True
                    )
            except IntegrityError:
                # Concurrent task handled this notification
                pass

    return {"status": "success", "notifications_dispatched": created_count}
