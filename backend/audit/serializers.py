from rest_framework import serializers
from .models import AuditEvent

class AuditEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', read_only=True)

    class Meta:
        model = AuditEvent
        fields = [
            'id',
            'actor_email',
            'action',
            'target_type',
            'target_id',
            'ip_address',
            'user_agent',
            'details',
            'prev_hash',
            'current_hash',
            'timestamp',
        ]
        read_only_fields = fields
