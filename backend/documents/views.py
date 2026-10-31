import urllib.parse
from datetime import datetime, timezone
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import views, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError
from drf_spectacular.utils import extend_schema

from .models import Document, DocumentCategory, DocumentTag, DocumentVersion, StorageObject
from .serializers import (
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentUploadSerializer,
    NewVersionUploadSerializer,
    DocumentCategorySerializer,
    DocumentTagSerializer,
    DocumentVersionSerializer,
)
from .storage_service import VaultStorageService, detect_mime_type_and_validate, sanitize_filename
from audit.service import record_audit_event

class CategoryListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        categories = DocumentCategory.objects.all()
        return Response(DocumentCategorySerializer(categories, many=True).data)


class TagListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tags = DocumentTag.objects.filter(user=request.user)
        return Response(DocumentTagSerializer(tags, many=True).data)


class DocumentListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: DocumentListSerializer(many=True)})
    def get(self, request):
        queryset = Document.objects.filter(owner=request.user, is_deleted=False)

        # Filters
        category_name = request.query_params.get('category')
        if category_name:
            queryset = queryset.filter(category__name=category_name)

        is_archived = request.query_params.get('archived')
        if is_archived is not None:
            queryset = queryset.filter(is_archived=is_archived.lower() in ('true', '1'))
        else:
            queryset = queryset.filter(is_archived=False)

        # Search query (title, description, issuer, tag name)
        search_query = request.query_params.get('q')
        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                Q(title__icontains=q) |
                Q(description__icontains=q) |
                Q(issuer__icontains=q) |
                Q(tags__name__icontains=q)
            ).distinct()

        # Ordering
        ordering = request.query_params.get('ordering', '-updated_at')
        allowed_orderings = ['-updated_at', 'updated_at', '-created_at', 'created_at', 'expiry_date', '-expiry_date', 'title', '-title']
        if ordering in allowed_orderings:
            queryset = queryset.order_by(ordering)

        serializer = DocumentListSerializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(request=DocumentUploadSerializer, responses={201: DocumentDetailSerializer})
    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            raise ValidationError("File payload is missing.")

        file_bytes = uploaded_file.read()
        clean_filename = sanitize_filename(uploaded_file.name)
        mime_type = detect_mime_type_and_validate(file_bytes, clean_filename)

        title = serializer.validated_data.get('title')
        if not title:
            title = clean_filename

        category_id = serializer.validated_data.get('category_id')
        category = None
        if category_id:
            try:
                category = DocumentCategory.objects.get(id=category_id)
            except DocumentCategory.DoesNotExist:
                raise ValidationError("Specified document category does not exist.")

        with transaction.atomic():
            # 1. Encrypt and store file
            storage_obj = VaultStorageService.store_file(
                file_bytes=file_bytes,
                original_filename=clean_filename,
                mime_type=mime_type
            )

            # 2. Create Document record
            document = Document.objects.create(
                owner=request.user,
                category=category,
                current_storage_object=storage_obj,
                title=title,
                description=serializer.validated_data.get('description', ''),
                original_filename=clean_filename,
                mime_type=mime_type,
                current_version=1,
                issue_date=serializer.validated_data.get('issue_date'),
                expiry_date=serializer.validated_data.get('expiry_date'),
                issuer=serializer.validated_data.get('issuer', ''),
                reference_number=serializer.validated_data.get('reference_number', '')
            )

            # 3. Create initial DocumentVersion (v1)
            DocumentVersion.objects.create(
                document=document,
                storage_object=storage_obj,
                version_number=1,
                version_notes="Initial version upload",
                uploaded_by=request.user,
                file_size=len(file_bytes),
                sha256_hash=storage_obj.sha256_hash
            )

            # 4. Handle tags
            raw_tags = request.data.getlist('tags') if hasattr(request.data, 'getlist') and request.data.getlist('tags') else serializer.validated_data.get('tags', [])
            for tag_name in raw_tags:
                clean_tag = tag_name.strip()
                if clean_tag:
                    tag, _ = DocumentTag.objects.get_or_create(user=request.user, name=clean_tag)
                    document.tags.add(tag)

            # 5. Update user profile storage bytes
            profile = request.user.profile
            profile.storage_used_bytes += len(file_bytes)
            profile.save(update_fields=['storage_used_bytes'])

            # 6. Audit event
            record_audit_event(
                action="DOCUMENT_UPLOAD",
                actor=request.user,
                target_type="Document",
                target_id=str(document.id),
                details={
                    "title": document.title,
                    "filename": clean_filename,
                    "file_size": len(file_bytes),
                    "mime_type": mime_type,
                    "sha256": storage_obj.sha256_hash,
                },
                request=request
            )

        return Response(DocumentDetailSerializer(document).data, status=status.HTTP_201_CREATED)


class DocumentDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_document(self, request, pk):
        try:
            document = Document.objects.select_related('owner', 'category', 'current_storage_object').prefetch_related('tags', 'versions').get(id=pk)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        # Ownership authorization check
        if document.owner != request.user:
            raise PermissionDenied("You do not have permission to access this document.")

        return document

    @extend_schema(responses={200: DocumentDetailSerializer})
    def get(self, request, pk):
        document = self.get_document(request, pk)
        return Response(DocumentDetailSerializer(document).data)

    @extend_schema(request=DocumentDetailSerializer, responses={200: DocumentDetailSerializer})
    def patch(self, request, pk):
        document = self.get_document(request, pk)
        serializer = DocumentDetailSerializer(document, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if 'category_id' in serializer.validated_data:
            cat_id = serializer.validated_data.pop('category_id')
            document.category = DocumentCategory.objects.filter(id=cat_id).first() if cat_id else None

        if 'tag_names' in serializer.validated_data:
            tag_names = serializer.validated_data.pop('tag_names')
            document.tags.clear()
            for name in tag_names:
                clean_name = name.strip()
                if clean_name:
                    tag, _ = DocumentTag.objects.get_or_create(user=request.user, name=clean_name)
                    document.tags.add(tag)

        serializer.save()

        record_audit_event(
            action="DOCUMENT_UPDATE",
            actor=request.user,
            target_type="Document",
            target_id=str(document.id),
            details={"updated_fields": list(request.data.keys())},
            request=request
        )

        return Response(DocumentDetailSerializer(document).data)

    def delete(self, request, pk):
        """Soft delete (moves to trash bin)."""
        document = self.get_document(request, pk)
        document.is_deleted = True
        document.deleted_at = datetime.now(timezone.utc)
        document.save(update_fields=['is_deleted', 'deleted_at'])

        record_audit_event(
            action="DOCUMENT_SOFT_DELETE",
            actor=request.user,
            target_type="Document",
            target_id=str(document.id),
            details={"title": document.title},
            request=request
        )

        return Response({"message": "Document moved to trash. You can restore it anytime before retention expires."})


class DocumentDownloadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            document = Document.objects.select_related('owner', 'current_storage_object').get(id=pk, is_deleted=False)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        if document.owner != request.user:
            raise PermissionDenied("You do not have permission to download this document.")

        if not document.current_storage_object:
            raise NotFound("No physical storage artifact associated with this document.")

        plaintext_bytes = VaultStorageService.retrieve_plaintext(document.current_storage_object)

        # RFC 5987 encoded safe Content-Disposition
        safe_filename = sanitize_filename(document.original_filename)
        encoded_filename = urllib.parse.quote(safe_filename)

        response = HttpResponse(plaintext_bytes, content_type=document.mime_type)
        response['Content-Disposition'] = f"attachment; filename=\"{safe_filename}\"; filename*=UTF-8''{encoded_filename}"
        response['Content-Length'] = len(plaintext_bytes)
        response['X-Content-Type-Options'] = 'nosniff'

        record_audit_event(
            action="DOCUMENT_DOWNLOAD",
            actor=request.user,
            target_type="Document",
            target_id=str(document.id),
            details={"filename": safe_filename, "version": document.current_version},
            request=request
        )

        return response


class DocumentPreviewView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            document = Document.objects.select_related('owner', 'current_storage_object').get(id=pk, is_deleted=False)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        if document.owner != request.user:
            raise PermissionDenied("You do not have permission to preview this document.")

        plaintext_bytes = VaultStorageService.retrieve_plaintext(document.current_storage_object)

        response = HttpResponse(plaintext_bytes, content_type=document.mime_type)
        response['Content-Disposition'] = 'inline'
        response['Content-Length'] = len(plaintext_bytes)
        response['X-Content-Type-Options'] = 'nosniff'

        record_audit_event(
            action="DOCUMENT_PREVIEW",
            actor=request.user,
            target_type="Document",
            target_id=str(document.id),
            details={"version": document.current_version},
            request=request
        )

        return response


class DocumentVersionListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            document = Document.objects.get(id=pk, owner=request.user, is_deleted=False)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        versions = document.versions.all()
        return Response(DocumentVersionSerializer(versions, many=True).data)

    @extend_schema(request=NewVersionUploadSerializer)
    def post(self, request, pk):
        try:
            document = Document.objects.get(id=pk, owner=request.user, is_deleted=False)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        serializer = NewVersionUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            raise ValidationError("File is required for new version upload.")

        file_bytes = uploaded_file.read()
        clean_filename = sanitize_filename(uploaded_file.name)
        mime_type = detect_mime_type_and_validate(file_bytes, clean_filename)

        with transaction.atomic():
            storage_obj = VaultStorageService.store_file(
                file_bytes=file_bytes,
                original_filename=clean_filename,
                mime_type=mime_type
            )

            new_version_num = document.current_version + 1

            version = DocumentVersion.objects.create(
                document=document,
                storage_object=storage_obj,
                version_number=new_version_num,
                version_notes=serializer.validated_data.get('version_notes', ''),
                uploaded_by=request.user,
                file_size=len(file_bytes),
                sha256_hash=storage_obj.sha256_hash
            )

            # Update document current version pointer
            document.current_version = new_version_num
            document.current_storage_object = storage_obj
            document.mime_type = mime_type
            document.save(update_fields=['current_version', 'current_storage_object', 'mime_type', 'updated_at'])

            record_audit_event(
                action="DOCUMENT_VERSION_UPLOAD",
                actor=request.user,
                target_type="DocumentVersion",
                target_id=str(version.id),
                details={
                    "document_id": str(document.id),
                    "version_number": new_version_num,
                    "sha256": storage_obj.sha256_hash,
                },
                request=request
            )

        return Response(DocumentVersionSerializer(version).data, status=status.HTTP_201_CREATED)


class DocumentVersionDownloadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, version_number):
        try:
            document = Document.objects.get(id=pk, owner=request.user, is_deleted=False)
            version = DocumentVersion.objects.select_related('storage_object').get(
                document=document,
                version_number=version_number
            )
        except (Document.DoesNotExist, DocumentVersion.DoesNotExist):
            raise NotFound("Specified document version not found.")

        plaintext_bytes = VaultStorageService.retrieve_plaintext(version.storage_object)

        safe_filename = sanitize_filename(f"v{version_number}_{document.original_filename}")
        response = HttpResponse(plaintext_bytes, content_type=version.storage_object.mime_type)
        response['Content-Disposition'] = f"attachment; filename=\"{safe_filename}\""
        response['Content-Length'] = len(plaintext_bytes)

        record_audit_event(
            action="DOCUMENT_VERSION_DOWNLOAD",
            actor=request.user,
            target_type="DocumentVersion",
            target_id=str(version.id),
            details={"version_number": version_number},
            request=request
        )

        return response


class DocumentVersionRestoreView(views.APIView):
    """Restores a previous historical version as current without destroying history."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, version_number):
        try:
            document = Document.objects.get(id=pk, owner=request.user, is_deleted=False)
            target_version = DocumentVersion.objects.select_related('storage_object').get(
                document=document,
                version_number=version_number
            )
        except (Document.DoesNotExist, DocumentVersion.DoesNotExist):
            raise NotFound("Document or historical version not found.")

        with transaction.atomic():
            document.current_storage_object = target_version.storage_object
            document.mime_type = target_version.storage_object.mime_type
            document.save(update_fields=['current_storage_object', 'mime_type', 'updated_at'])

            record_audit_event(
                action="DOCUMENT_VERSION_RESTORE",
                actor=request.user,
                target_type="Document",
                target_id=str(document.id),
                details={"restored_to_version": version_number},
                request=request
            )

        return Response({
            "message": f"Document restored to version {version_number} successfully.",
            "document": DocumentDetailSerializer(document).data
        })


class DocumentTrashListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        trash_docs = Document.objects.filter(owner=request.user, is_deleted=True).order_by('-deleted_at')
        return Response(DocumentListSerializer(trash_docs, many=True).data)


class DocumentRestoreView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            document = Document.objects.get(id=pk, owner=request.user, is_deleted=True)
        except Document.DoesNotExist:
            raise NotFound("Document not found in trash.")

        document.is_deleted = False
        document.deleted_at = None
        document.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])

        record_audit_event(
            action="DOCUMENT_RESTORE_FROM_TRASH",
            actor=request.user,
            target_type="Document",
            target_id=str(document.id),
            details={"title": document.title},
            request=request
        )

        return Response({"message": "Document successfully restored from trash."})


class DocumentPermanentDeleteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            document = Document.objects.prefetch_related('versions__storage_object').get(id=pk, owner=request.user)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        with transaction.atomic():
            # Cryptographically delete all underlying storage objects
            for ver in document.versions.all():
                VaultStorageService.delete_file(ver.storage_object)

            doc_title = document.title
            doc_id = str(document.id)
            document.delete()

            record_audit_event(
                action="DOCUMENT_PERMANENT_DELETE",
                actor=request.user,
                target_type="Document",
                target_id=doc_id,
                details={"title": doc_title},
                request=request
            )

        return Response({"message": "Document and all encrypted artifacts permanently shredded."})


class DocumentArchiveToggleView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            document = Document.objects.get(id=pk, owner=request.user, is_deleted=False)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        document.is_archived = not document.is_archived
        document.save(update_fields=['is_archived', 'updated_at'])

        record_audit_event(
            action="DOCUMENT_ARCHIVE_TOGGLE",
            actor=request.user,
            target_type="Document",
            target_id=str(document.id),
            details={"is_archived": document.is_archived},
            request=request
        )

        status_str = "archived" if document.is_archived else "unarchived"
        return Response({"message": f"Document {status_str} successfully.", "is_archived": document.is_archived})
