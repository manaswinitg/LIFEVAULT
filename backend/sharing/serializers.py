from rest_framework import serializers
from .models import ShareGrant, ShareAccessLog

class ShareAccessLogSerializer(serializers.ModelSerializer):
    accessed_by_email = serializers.EmailField(source='accessed_by.email', read_only=True)

    class Meta:
        model = ShareAccessLog
        fields = ['id', 'accessed_by_email', 'ip_address', 'user_agent', 'action', 'success', 'accessed_at']


class ShareGrantSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source='document.title', read_only=True)
    shared_with_email = serializers.EmailField(source='shared_with.email', read_only=True)
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    access_logs = ShareAccessLogSerializer(many=True, read_only=True)

    class Meta:
        model = ShareGrant
        fields = [
            'id',
            'document_id',
            'document_title',
            'owner_email',
            'shared_with_email',
            'permission',
            'expires_at',
            'max_downloads',
            'download_count',
            'is_revoked',
            'revoked_at',
            'created_at',
            'access_logs',
        ]
        read_only_fields = ['id', 'document_title', 'owner_email', 'shared_with_email', 'download_count', 'is_revoked', 'revoked_at', 'created_at']


class CreateShareGrantSerializer(serializers.Serializer):
    document_id = serializers.UUIDField(required=True)
    share_type = serializers.ChoiceField(choices=['user', 'link'], default='link')
    shared_with_email = serializers.EmailField(required=False, allow_blank=True)
    permission = serializers.ChoiceField(choices=['view', 'download'], default='view')
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    max_downloads = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def validate(self, attrs):
        if attrs.get('share_type') == 'user' and not attrs.get('shared_with_email'):
            raise serializers.ValidationError({"shared_with_email": "Email address is required for user-to-user sharing."})
        return attrs


class PublicShareDocumentSerializer(serializers.Serializer):
    title = serializers.CharField()
    original_filename = serializers.CharField()
    mime_type = serializers.CharField()
    file_size = serializers.IntegerField()
    permission = serializers.CharField()
    expires_at = serializers.DateTimeField(allow_null=True)
    max_downloads = serializers.IntegerField(allow_null=True)
    download_count = serializers.IntegerField()
