import pytest
from datetime import datetime, timezone, timedelta
from rest_framework.test import APIClient
from accounts.models import User
from documents.models import Document
from documents.storage_service import VaultStorageService
from emergency_access.models import TrustedContact, EmergencyAccessPolicy, EmergencyAccessRequest
from reminders.models import Notification
from audit.service import verify_audit_chain

@pytest.mark.django_db
class TestEmergencyAccessAndAuditHistory:

    def setup_method(self):
        self.owner = User.objects.create_user(email="owner_em@lifevault.local", password="StrongPassword123!")
        self.client_owner = APIClient()
        self.client_owner.force_authenticate(user=self.owner)

        # Setup document
        storage_obj = VaultStorageService.store_file(b"%PDF-1.4 Will and Testament", "will.pdf", "application/pdf")
        self.doc = Document.objects.create(
            owner=self.owner,
            current_storage_object=storage_obj,
            title="Last Will and Testament",
            original_filename="will.pdf",
            mime_type="application/pdf"
        )

    def test_emergency_contact_and_policy_creation(self):
        # 1. Add contact
        contact_res = self.client_owner.post('/api/emergency/contacts/', {
            'contact_name': 'Jane Doe',
            'contact_email': 'jane.doe@trusted.local',
            'relationship': 'Sister',
            'phone': '+1-555-0199'
        })
        assert contact_res.status_code == 201
        contact_id = contact_res.json()['id']

        # 2. Create policy
        policy_res = self.client_owner.post('/api/emergency/policies/', {
            'trusted_contact_id': contact_id,
            'waiting_period_hours': 48,
            'can_access_all': False,
            'document_ids': [str(self.doc.id)]
        })
        assert policy_res.status_code == 201
        assert policy_res.json()['waiting_period_hours'] == 48

    def test_emergency_request_veto_and_cancellation(self):
        contact = TrustedContact.objects.create(
            owner=self.owner,
            contact_name="Brother Bob",
            contact_email="bob@trusted.local",
            relationship="Brother"
        )
        policy = EmergencyAccessPolicy.objects.create(
            owner=self.owner,
            trusted_contact=contact,
            waiting_period_hours=24,
            can_access_all=True
        )

        anon_client = APIClient()

        # 1. Contact initiates request
        req_res = anon_client.post('/api/emergency/requests/initiate/', {
            'policy_id': str(policy.id),
            'contact_email': 'bob@trusted.local',
            'reason': 'Medical emergency hospital admission'
        })
        assert req_res.status_code == 201
        request_id = req_res.json()['id']
        assert req_res.json()['status'] == 'pending'

        # 2. Vault owner receives urgent notification
        owner_notifs = Notification.objects.filter(user=self.owner, notification_type='emergency')
        assert owner_notifs.exists()
        assert "URGENT" in owner_notifs.first().title

        # 3. Vault owner vetoes/cancels the request before deadline
        cancel_res = self.client_owner.post(f'/api/emergency/requests/{request_id}/cancel/')
        assert cancel_res.status_code == 200
        assert cancel_res.json()['status'] == 'cancelled'

        # 4. Access to documents is blocked (403)
        docs_res = anon_client.get(f'/api/emergency/requests/{request_id}/documents/')
        assert docs_res.status_code == 403

    def test_explicit_early_approval_grants_document_access(self):
        contact = TrustedContact.objects.create(
            owner=self.owner,
            contact_name="Spouse Alice",
            contact_email="alice@family.local"
        )
        policy = EmergencyAccessPolicy.objects.create(
            owner=self.owner,
            trusted_contact=contact,
            waiting_period_hours=72,
            can_access_all=True
        )

        anon_client = APIClient()
        req_res = anon_client.post('/api/emergency/requests/initiate/', {
            'policy_id': str(policy.id),
            'contact_email': 'alice@family.local',
            'reason': 'Family travel abroad document retrieval'
        })
        request_id = req_res.json()['id']

        # Owner explicitly approves early
        approve_res = self.client_owner.post(f'/api/emergency/requests/{request_id}/approve/')
        assert approve_res.status_code == 200
        assert approve_res.json()['status'] == 'approved'

        # Now documents can be listed
        docs_res = anon_client.get(f'/api/emergency/requests/{request_id}/documents/')
        assert docs_res.status_code == 200
        assert len(docs_res.json()) >= 1
        assert docs_res.json()[0]['title'] == "Last Will and Testament"

    def test_audit_log_endpoint_and_chain_verification_view(self):
        # Create an action via API that triggers an audit log
        self.client_owner.post('/api/emergency/contacts/', {
            'contact_name': 'Audit Tester',
            'contact_email': 'audit@test.local'
        })

        # Retrieve audit list
        list_res = self.client_owner.get('/api/audit/')
        assert list_res.status_code == 200
        assert isinstance(list_res.json(), list)
        assert len(list_res.json()) >= 1

        # Cryptographic verification check
        verify_res = self.client_owner.get('/api/audit/verify/')
        assert verify_res.status_code == 200
        data = verify_res.json()
        assert data['is_valid'] is True
        assert data['total_events'] > 0
        assert data['broken_event_id'] is None
