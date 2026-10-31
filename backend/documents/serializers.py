from rest_framework import serializers
from .models import Document, DocumentCategory, DocumentTag, DocumentVersion, StorageObject

class DocumentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentCategory
        fields = ['id', 'name', 'display_name', 'description', 'icon', 'is_system']


class DocumentTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTag
        fields = ['id', 'name', 'color']
        read_only_fields = ['id']


class DocumentVersionSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(source='uploaded_by.email', read_only=True)

    class Meta:
        model = DocumentVersion
        fields = [
            'id',
            'version_number',
            'version_notes',
            'uploaded_by_email',
            'file_size',
            'sha256_hash',
            'created_at',
        ]
        read_only_fields = ['id', 'version_number', 'uploaded_by_email', 'file_size', 'sha256_hash', 'created_at']


class DocumentListSerializer(serializers.ModelSerializer):
    category = DocumentCategorySerializer(read_only=True)
    tags = DocumentTagSerializer(many=True, read_only=True)
    file_size = serializers.IntegerField(source='current_storage_object.file_size', read_only=True)
    sha256_hash = serializers.CharField(source='current_storage_object.sha256_hash', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'title',
            'description',
            'category',
            'original_filename',
            'mime_type',
            'file_size',
            'sha256_hash',
            'current_version',
            'issue_date',
            'expiry_date',
            'issuer',
            'tags',
            'is_archived',
            'is_deleted',
            'deleted_at',
            'created_at',
            'updated_at',
        ]


class DocumentDetailSerializer(serializers.ModelSerializer):
    category = DocumentCategorySerializer(read_only=True)
    category_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    tags = DocumentTagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(child=serializers.CharField(max_length=50), write_only=True, required=False)
    versions = DocumentVersionSerializer(many=True, read_only=True)
    file_size = serializers.IntegerField(source='current_storage_object.file_size', read_only=True)
    sha256_hash = serializers.CharField(source='current_storage_object.sha256_hash', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'title',
            'description',
            'category',
            'category_id',
            'original_filename',
            'mime_type',
            'file_size',
            'sha256_hash',
            'current_version',
            'issue_date',
            'expiry_date',
            'issuer',
            'reference_number',
            'tags',
            'tag_names',
            'versions',
            'is_archived',
            'is_deleted',
            'deleted_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'current_version', 'mime_type', 'original_filename', 'is_deleted', 'deleted_at', 'created_at', 'updated_at']


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    category_id = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    issue_date = serializers.DateField(required=False, allow_null=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    issuer = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False)


class NewVersionUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)
    version_notes = serializers.CharField(required=False, allow_blank=True)
