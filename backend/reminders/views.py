from datetime import datetime, timezone, date
from rest_framework import views, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from drf_spectacular.utils import extend_schema

from documents.models import Document
from documents.serializers import DocumentListSerializer
from .models import DocumentReminder, Notification
from .serializers import DocumentReminderSerializer, NotificationSerializer
from audit.service import record_audit_event

class UpcomingExpirationsListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        docs = Document.objects.filter(
            owner=request.user,
            is_deleted=False,
            expiry_date__isnull=False
        ).order_by('expiry_date')
        
        return Response(DocumentListSerializer(docs, many=True).data)


class ReminderListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        reminders = DocumentReminder.objects.filter(user=request.user).select_related('document')
        return Response(DocumentReminderSerializer(reminders, many=True).data)

    def post(self, request):
        doc_id = request.data.get('document_id')
        days_before = int(request.data.get('reminder_days_before', 30))

        try:
            document = Document.objects.get(id=doc_id, owner=request.user, is_deleted=False)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        if not document.expiry_date:
            raise ValidationError("Cannot configure expiry reminder on a document without an expiry date.")

        reminder, created = DocumentReminder.objects.get_or_create(
            document=document,
            user=request.user,
            reminder_days_before=days_before,
            defaults={'is_resolved': False}
        )
        if not created and reminder.is_resolved:
            reminder.is_resolved = False
            reminder.resolved_at = None
            reminder.save(update_fields=['is_resolved', 'resolved_at'])

        record_audit_event(
            action="REMINDER_CONFIGURED",
            actor=request.user,
            target_type="DocumentReminder",
            target_id=str(reminder.id),
            details={"document_id": str(document.id), "days_before": days_before},
            request=request
        )

        return Response(DocumentReminderSerializer(reminder).data, status=status.HTTP_201_CREATED)


class ReminderResolveView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            reminder = DocumentReminder.objects.get(id=pk, user=request.user)
        except DocumentReminder.DoesNotExist:
            raise NotFound("Reminder not found.")

        reminder.is_resolved = True
        reminder.resolved_at = datetime.now(timezone.utc)
        reminder.save(update_fields=['is_resolved', 'resolved_at'])

        return Response(DocumentReminderSerializer(reminder).data)


class NotificationListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        unread_count = notifications.filter(is_read=False).count()
        return Response({
            "unread_count": unread_count,
            "results": NotificationSerializer(notifications[:50], many=True).data
        })


class NotificationMarkReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, user=request.user)
        except Notification.DoesNotExist:
            raise NotFound("Notification not found.")

        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        notification.save(update_fields=['is_read', 'read_at'])

        return Response({"message": "Marked as read."})


class NotificationMarkAllReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True,
            read_at=datetime.now(timezone.utc)
        )
        return Response({"message": "All notifications marked as read."})
