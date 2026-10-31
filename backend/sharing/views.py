import secrets
import urllib.parse
from datetime import datetime, timezone
from django.db import transaction
from django.http import HttpResponse
from rest_framework import views, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from drf_spectacular.utils import extend_schema

from accounts.models import User
from documents.models import Document
from documents.storage_service import VaultStorageService, sanitize_filename
from .models import ShareGrant, ShareAccessLog
from .serializers import (
    ShareGrantSerializer,
    CreateShareGrantSerializer,
    PublicShareDocumentSerializer,
)
from audit.service import record_audit_event, get_client_ip, get_client_user_agent

class ShareGrantListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        shares = ShareGrant.objects.filter(owner=request.user).select_related('document', 'shared_with').prefetch_related('access_logs')
        return Response(ShareGrantSerializer(shares, many=True).data)

    @extend_schema(request=CreateShareGrantSerializer)
    def post(self, request):
        serializer = CreateShareGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            document = Document.objects.get(id=data['document_id'], owner=request.user, is_deleted=False)
        except Document.DoesNotExist:
            raise NotFound("Document not found.")

        shared_with = None
        raw_token = None
        token_hash = None

        if data['share_type'] == 'user':
            target_email = data['shared_with_email'].strip().lower()
            if target_email == request.user.email.lower():
                raise ValidationError("You cannot share a document with yourself.")
            try:
                shared_with = User.objects.get(email=target_email)
            except User.DoesNotExist:
                raise ValidationError("No registered LifeVault user found with this email.")
        else: # 'link'
            raw_token = secrets.token_urlsafe(32)
            token_hash = ShareGrant.hash_token(raw_token)

        grant = ShareGrant.objects.create(
            document=document,
            owner=request.user,
            shared_with=shared_with,
            token_hash=token_hash,
            permission=data['permission'],
            expires_at=data.get('expires_at'),
            max_downloads=data.get('max_downloads')
        )

        record_audit_event(
            action="SHARE_GRANT_CREATED",
            actor=request.user,
            target_type="ShareGrant",
            target_id=str(grant.id),
            details={
                "document_id": str(document.id),
                "share_type": data['share_type'],
                "permission": data['permission'],
                "shared_with": shared_with.email if shared_with else "public_link",
            },
            request=request
        )

        response_data = ShareGrantSerializer(grant).data
        if raw_token:
            response_data["access_token"] = raw_token
            response_data["share_url"] = f"/share/{raw_token}"

        return Response(response_data, status=status.HTTP_201_CREATED)


class ShareGrantRevokeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            grant = ShareGrant.objects.get(id=pk, owner=request.user)
        except ShareGrant.DoesNotExist:
            raise NotFound("Share grant not found.")

        grant.is_revoked = True
        grant.revoked_at = datetime.now(timezone.utc)
        grant.save(update_fields=['is_revoked', 'revoked_at'])

        record_audit_event(
            action="SHARE_GRANT_REVOKED",
            actor=request.user,
            target_type="ShareGrant",
            target_id=str(grant.id),
            details={"document_id": str(grant.document.id)},
            request=request
        )

        return Response({"message": "Share grant successfully revoked."})


class SharedWithMeListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        shares = ShareGrant.objects.filter(
            shared_with=request.user,
            is_revoked=False,
            document__is_deleted=False
        ).select_related('document', 'owner', 'document__current_storage_object')

        # Filter out expired
        now = datetime.now(timezone.utc)
        valid_shares = [s for s in shares if not s.expires_at or s.expires_at > now]
        return Response(ShareGrantSerializer(valid_shares, many=True).data)


class PublicShareMetadataView(views.APIView):
    """
    Public access to shared document metadata via secure token.
    Token is resolved by its SHA-256 hash.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        token_hash = ShareGrant.hash_token(token)
        try:
            grant = ShareGrant.objects.select_related('document', 'document__current_storage_object').get(token_hash=token_hash)
        except ShareGrant.DoesNotExist:
            return Response({"error": {"message": "Invalid share link."}}, status=status.HTTP_404_NOT_FOUND)

        is_valid, reason = grant.is_valid()
        if not is_valid:
            ShareAccessLog.objects.create(
                share_grant=grant,
                ip_address=get_client_ip(request),
                user_agent=get_client_user_agent(request),
                action='view',
                success=False
            )
            return Response({"error": {"message": reason}}, status=status.HTTP_403_FORBIDDEN)

        # Log successful view
        ShareAccessLog.objects.create(
            share_grant=grant,
            accessed_by=request.user if request.user.is_authenticated else None,
            ip_address=get_client_ip(request),
            user_agent=get_client_user_agent(request),
            action='view',
            success=True
        )

        doc = grant.document
        data = {
            "title": doc.title,
            "description": doc.description,
            "original_filename": doc.original_filename,
            "mime_type": doc.mime_type,
            "file_size": doc.current_storage_object.file_size if doc.current_storage_object else 0,
            "permission": grant.permission,
            "expires_at": grant.expires_at,
            "max_downloads": grant.max_downloads,
            "download_count": grant.download_count,
            "can_download": grant.permission == 'download' and (not grant.max_downloads or grant.download_count < grant.max_downloads)
        }
        return Response(data)


class PublicShareDownloadView(views.APIView):
    """
    Public download endpoint for shared document.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        token_hash = ShareGrant.hash_token(token)
        try:
            grant = ShareGrant.objects.select_related('document', 'document__current_storage_object').get(token_hash=token_hash)
        except ShareGrant.DoesNotExist:
            return Response({"error": {"message": "Invalid share link."}}, status=status.HTTP_404_NOT_FOUND)

        is_valid, reason = grant.is_valid()
        if not is_valid:
            ShareAccessLog.objects.create(
                share_grant=grant,
                ip_address=get_client_ip(request),
                user_agent=get_client_user_agent(request),
                action='download',
                success=False
            )
            return Response({"error": {"message": reason}}, status=status.HTTP_403_FORBIDDEN)

        if grant.permission != 'download':
            return Response({"error": {"message": "This share link is view-only and does not permit downloads."}}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            # Increment download count
            grant.download_count += 1
            grant.save(update_fields=['download_count'])

            ShareAccessLog.objects.create(
                share_grant=grant,
                accessed_by=request.user if request.user.is_authenticated else None,
                ip_address=get_client_ip(request),
                user_agent=get_client_user_agent(request),
                action='download',
                success=True
            )

        doc = grant.document
        plaintext_bytes = VaultStorageService.retrieve_plaintext(doc.current_storage_object)

        safe_filename = sanitize_filename(doc.original_filename)
        encoded_filename = urllib.parse.quote(safe_filename)

        response = HttpResponse(plaintext_bytes, content_type=doc.mime_type)
        response['Content-Disposition'] = f"attachment; filename=\"{safe_filename}\"; filename*=UTF-8''{encoded_filename}"
        response['Content-Length'] = len(plaintext_bytes)
        response['X-Content-Type-Options'] = 'nosniff'

        return response
