from datetime import datetime, timezone, timedelta
from django.db import transaction
from django.conf import settings
from django.core.mail import send_mail
from rest_framework import views, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from drf_spectacular.utils import extend_schema

from accounts.models import User
from documents.models import Document
from documents.serializers import DocumentListSerializer
from reminders.models import Notification
from .models import TrustedContact, EmergencyAccessPolicy, EmergencyAccessRequest
from .serializers import (
    TrustedContactSerializer,
    EmergencyAccessPolicySerializer,
    EmergencyAccessRequestSerializer,
)
from audit.service import record_audit_event

class TrustedContactListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        contacts = TrustedContact.objects.filter(owner=request.user)
        return Response(TrustedContactSerializer(contacts, many=True).data)

    @extend_schema(request=TrustedContactSerializer)
    def post(self, request):
        serializer = TrustedContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['contact_email'].strip().lower()
        if email == request.user.email.lower():
            raise ValidationError("You cannot designate yourself as a trusted contact.")

        contact, created = TrustedContact.objects.get_or_create(
            owner=request.user,
            contact_email=email,
            defaults={
                'contact_name': serializer.validated_data['contact_name'],
                'phone': serializer.validated_data.get('phone', ''),
                'relationship': serializer.validated_data.get('relationship', ''),
                'is_verified': True
            }
        )

        record_audit_event(
            action="EMERGENCY_CONTACT_ADDED",
            actor=request.user,
            target_type="TrustedContact",
            target_id=str(contact.id),
            details={"email": contact.contact_email, "name": contact.contact_name},
            request=request
        )

        return Response(TrustedContactSerializer(contact).data, status=status.HTTP_201_CREATED)


class TrustedContactDeleteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            contact = TrustedContact.objects.get(id=pk, owner=request.user)
        except TrustedContact.DoesNotExist:
            raise NotFound("Trusted contact not found.")

        contact_id = str(contact.id)
        email = contact.contact_email
        contact.delete()

        record_audit_event(
            action="EMERGENCY_CONTACT_REMOVED",
            actor=request.user,
            target_type="TrustedContact",
            target_id=contact_id,
            details={"email": email},
            request=request
        )

        return Response({"message": "Trusted contact removed."})


class EmergencyPolicyListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        policies = EmergencyAccessPolicy.objects.filter(owner=request.user).select_related('trusted_contact').prefetch_related('specific_documents')
        return Response(EmergencyAccessPolicySerializer(policies, many=True).data)

    @extend_schema(request=EmergencyAccessPolicySerializer)
    def post(self, request):
        serializer = EmergencyAccessPolicySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            contact = TrustedContact.objects.get(id=data['trusted_contact_id'], owner=request.user)
        except TrustedContact.DoesNotExist:
            raise NotFound("Trusted contact not found.")

        with transaction.atomic():
            policy = EmergencyAccessPolicy.objects.create(
                owner=request.user,
                trusted_contact=contact,
                waiting_period_hours=data.get('waiting_period_hours', 48),
                can_access_all=data.get('can_access_all', False),
                is_active=True
            )

            if not policy.can_access_all and 'document_ids' in data:
                docs = Document.objects.filter(id__in=data['document_ids'], owner=request.user)
                policy.specific_documents.set(docs)

            record_audit_event(
                action="EMERGENCY_POLICY_CREATED",
                actor=request.user,
                target_type="EmergencyAccessPolicy",
                target_id=str(policy.id),
                details={
                    "trusted_contact": contact.contact_email,
                    "waiting_period_hours": policy.waiting_period_hours,
                    "can_access_all": policy.can_access_all,
                },
                request=request
            )

        return Response(EmergencyAccessPolicySerializer(policy).data, status=status.HTTP_201_CREATED)


class EmergencyRequestInitiateView(views.APIView):
    """
    Initiates emergency access request.
    Can be called by trusted contact with policy ID and contact email confirmation.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        policy_id = request.data.get('policy_id')
        contact_email = request.data.get('contact_email', '').strip().lower()
        trigger_reason = request.data.get('reason', '').strip()

        if not trigger_reason:
            raise ValidationError("A clear statement of reason/circumstances is required.")

        try:
            policy = EmergencyAccessPolicy.objects.select_related('owner', 'trusted_contact').get(
                id=policy_id,
                trusted_contact__contact_email__iexact=contact_email,
                is_active=True
            )
        except EmergencyAccessPolicy.DoesNotExist:
            raise NotFound("Valid active emergency access policy matching this identifier and contact email not found.")

        now = datetime.now(timezone.utc)
        deadline = now + timedelta(hours=policy.waiting_period_hours)

        with transaction.atomic():
            req = EmergencyAccessRequest.objects.create(
                policy=policy,
                status='pending',
                trigger_reason=trigger_reason,
                cancellation_deadline=deadline
            )

            # Alert vault owner immediately via in-app notification
            dedup_key = f"emergency_trigger:{req.id}:{now.isoformat()}"
            Notification.objects.create(
                user=policy.owner,
                title=f"URGENT: Emergency Access Requested by {policy.trusted_contact.contact_name}",
                message=(
                    f"{policy.trusted_contact.contact_name} ({policy.trusted_contact.contact_email}) has requested emergency access to your vault. "
                    f"Reason: '{trigger_reason}'. You have {policy.waiting_period_hours} hours (until {deadline.strftime('%Y-%m-%d %H:%M UTC')}) "
                    f"to cancel this request if this was not authorized."
                ),
                notification_type='emergency',
                deduplication_key=dedup_key
            )

            # Also send email notice
            send_mail(
                subject="URGENT: Emergency Access Requested for your LifeVault",
                message=f"Emergency access was requested. If this was unauthorized, log in immediately and click Cancel.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[policy.owner.email],
                fail_silently=True
            )

            record_audit_event(
                action="EMERGENCY_ACCESS_REQUESTED",
                actor=None,
                target_type="EmergencyAccessRequest",
                target_id=str(req.id),
                details={
                    "policy_id": str(policy.id),
                    "contact_email": contact_email,
                    "deadline": deadline.isoformat(),
                    "reason": trigger_reason
                },
                request=request
            )

        return Response(EmergencyAccessRequestSerializer(req).data, status=status.HTTP_201_CREATED)


class EmergencyRequestCancelView(views.APIView):
    """
    Vault owner cancels/vetoes an emergency access request before deadline.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = EmergencyAccessRequest.objects.select_related('policy', 'policy__owner').get(
                id=pk,
                policy__owner=request.user
            )
        except EmergencyAccessRequest.DoesNotExist:
            raise NotFound("Emergency request not found.")

        if req.status != 'pending':
            raise ValidationError(f"Cannot cancel a request that is already '{req.status}'.")

        req.status = 'cancelled'
        req.save(update_fields=['status'])

        record_audit_event(
            action="EMERGENCY_ACCESS_CANCELLED",
            actor=request.user,
            target_type="EmergencyAccessRequest",
            target_id=str(req.id),
            details={"reason": "Owner vetoed emergency request"},
            request=request
        )

        return Response({"message": "Emergency access request has been cancelled/vetoed.", "status": "cancelled"})


class EmergencyRequestApproveView(views.APIView):
    """
    Vault owner can explicitly grant early approval without waiting for the timeout.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = EmergencyAccessRequest.objects.select_related('policy', 'policy__owner').get(
                id=pk,
                policy__owner=request.user
            )
        except EmergencyAccessRequest.DoesNotExist:
            raise NotFound("Emergency request not found.")

        now = datetime.now(timezone.utc)
        req.status = 'approved'
        req.approved_at = now
        req.expires_at = now + timedelta(days=7)
        req.save(update_fields=['status', 'approved_at', 'expires_at'])

        record_audit_event(
            action="EMERGENCY_ACCESS_APPROVED",
            actor=request.user,
            target_type="EmergencyAccessRequest",
            target_id=str(req.id),
            details={"approved_by": "Owner explicit early approval"},
            request=request
        )

        return Response(EmergencyAccessRequestSerializer(req).data)


class EmergencyRequestStatusView(views.APIView):
    """
    Public/contact check on request status. Applies maturity if waiting period elapsed.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            req = EmergencyAccessRequest.objects.select_related('policy', 'policy__trusted_contact', 'policy__owner').get(id=pk)
        except EmergencyAccessRequest.DoesNotExist:
            raise NotFound("Emergency request not found.")

        # Check if deadline passed and transition from pending to approved
        req.check_and_apply_maturity()

        return Response(EmergencyAccessRequestSerializer(req).data)


class EmergencyGrantedDocumentsView(views.APIView):
    """
    Returns documents permitted under an approved emergency access request.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            req = EmergencyAccessRequest.objects.select_related('policy', 'policy__owner').get(id=pk)
        except EmergencyAccessRequest.DoesNotExist:
            raise NotFound("Emergency request not found.")

        req.check_and_apply_maturity()

        if req.status != 'approved':
            return Response({"error": {"message": f"Emergency access is not approved (current status: {req.status})."}}, status=status.HTTP_403_FORBIDDEN)

        now = datetime.now(timezone.utc)
        if req.expires_at and now > req.expires_at:
            return Response({"error": {"message": "Emergency access period has expired."}}, status=status.HTTP_403_FORBIDDEN)

        policy = req.policy
        if policy.can_access_all:
            docs = Document.objects.filter(owner=policy.owner, is_deleted=False)
        else:
            docs = policy.specific_documents.filter(is_deleted=False)

        return Response(DocumentListSerializer(docs, many=True).data)
