from rest_framework import serializers
from documents.serializers import DocumentListSerializer
from .models import TrustedContact, EmergencyAccessPolicy, EmergencyAccessRequest

class TrustedContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustedContact
        fields = ['id', 'contact_name', 'contact_email', 'phone', 'relationship', 'is_verified', 'created_at']
        read_only_fields = ['id', 'is_verified', 'created_at']


class EmergencyAccessPolicySerializer(serializers.ModelSerializer):
    trusted_contact = TrustedContactSerializer(read_only=True)
    trusted_contact_id = serializers.UUIDField(write_only=True)
    specific_documents = DocumentListSerializer(many=True, read_only=True)
    document_ids = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False)

    class Meta:
        model = EmergencyAccessPolicy
        fields = [
            'id',
            'trusted_contact',
            'trusted_contact_id',
            'waiting_period_hours',
            'can_access_all',
            'specific_documents',
            'document_ids',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class EmergencyAccessRequestSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='policy.trusted_contact.contact_name', read_only=True)
    contact_email = serializers.CharField(source='policy.trusted_contact.contact_email', read_only=True)
    owner_email = serializers.CharField(source='policy.owner.email', read_only=True)

    class Meta:
        model = EmergencyAccessRequest
        fields = [
            'id',
            'policy_id',
            'contact_name',
            'contact_email',
            'owner_email',
            'status',
            'trigger_reason',
            'requested_at',
            'cancellation_deadline',
            'approved_at',
            'expires_at',
        ]
        read_only_fields = ['id', 'status', 'requested_at', 'cancellation_deadline', 'approved_at', 'expires_at']
