from rest_framework import serializers
from .models import DocumentReminder, Notification

class NotificationSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source='document.title', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'document_id',
            'document_title',
            'title',
            'message',
            'notification_type',
            'is_read',
            'read_at',
            'created_at',
        ]
        read_only_fields = ['id', 'document_id', 'document_title', 'title', 'message', 'notification_type', 'read_at', 'created_at']


class DocumentReminderSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source='document.title', read_only=True)
    expiry_date = serializers.DateField(source='document.expiry_date', read_only=True)

    class Meta:
        model = DocumentReminder
        fields = [
            'id',
            'document_id',
            'document_title',
            'expiry_date',
            'reminder_days_before',
            'is_resolved',
            'resolved_at',
            'created_at',
        ]
        read_only_fields = ['id', 'document_title', 'expiry_date', 'resolved_at', 'created_at']
