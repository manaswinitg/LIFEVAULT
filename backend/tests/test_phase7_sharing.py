import pytest
from datetime import datetime, timezone, timedelta
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from accounts.models import User
from documents.models import Document
from documents.storage_service import VaultStorageService
from sharing.models import ShareGrant, ShareAccessLog

SAMPLE_FILE_BYTES = b"%PDF-1.4 LifeVault Shared Contract Document\n%%EOF"

@pytest.mark.django_db
class TestSecureSharing:

    def setup_method(self):
        self.owner = User.objects.create_user(email="owner@lifevault.local", password="StrongPassword123!")
        self.recipient = User.objects.create_user(email="recipient@lifevault.local", password="StrongPassword123!")
        
        self.client_owner = APIClient()
        self.client_owner.force_authenticate(user=self.owner)

        self.client_recipient = APIClient()
        self.client_recipient.force_authenticate(user=self.recipient)

        # Create encrypted test document for owner
        storage_obj = VaultStorageService.store_file(SAMPLE_FILE_BYTES, "shared_doc.pdf", "application/pdf")
        self.doc = Document.objects.create(
            owner=self.owner,
            current_storage_object=storage_obj,
            title="House Rental Agreement",
            original_filename="shared_doc.pdf",
            mime_type="application/pdf",
        )

    def test_link_sharing_with_hashed_tokens_and_download(self):
        # 1. Create link share with download permission
        res = self.client_owner.post('/api/sharing/grants/', {
            'document_id': str(self.doc.id),
            'share_type': 'link',
            'permission': 'download',
            'max_downloads': 2
        })
        assert res.status_code == 201
        data = res.json()
        token = data['access_token']
        grant_id = data['id']

        # 2. Database stores token_hash, NEVER raw token
        grant = ShareGrant.objects.get(id=grant_id)
        assert grant.token_hash == ShareGrant.hash_token(token)
        assert grant.token_hash != token

        # 3. Public client retrieves metadata
        anon_client = APIClient()
        meta_res = anon_client.get(f'/api/sharing/public/{token}/')
        assert meta_res.status_code == 200
        assert meta_res.json()['title'] == "House Rental Agreement"

        # 4. Public client downloads file
        dl_res = anon_client.get(f'/api/sharing/public/{token}/download/')
        assert dl_res.status_code == 200
        assert dl_res.content == SAMPLE_FILE_BYTES

        grant.refresh_from_db()
        assert grant.download_count == 1

        # 5. Access logs recorded
        assert ShareAccessLog.objects.filter(share_grant=grant).count() >= 2

    def test_one_time_download_limit_enforcement(self):
        # Create share with max_downloads=1
        res = self.client_owner.post('/api/sharing/grants/', {
            'document_id': str(self.doc.id),
            'share_type': 'link',
            'permission': 'download',
            'max_downloads': 1
        })
        token = res.json()['access_token']

        anon_client = APIClient()
        
        # First download succeeds
        dl1 = anon_client.get(f'/api/sharing/public/{token}/download/')
        assert dl1.status_code == 200

        # Second download rejected (403 Forbidden)
        dl2 = anon_client.get(f'/api/sharing/public/{token}/download/')
        assert dl2.status_code == 403
        assert "Maximum permitted download limit has been reached" in str(dl2.json())

    def test_instant_revocation(self):
        res = self.client_owner.post('/api/sharing/grants/', {
            'document_id': str(self.doc.id),
            'share_type': 'link',
            'permission': 'download'
        })
        token = res.json()['access_token']
        grant_id = res.json()['id']

        # Revoke grant
        revoke_res = self.client_owner.post(f'/api/sharing/grants/{grant_id}/revoke/')
        assert revoke_res.status_code == 200

        # Public access now blocked
        anon_client = APIClient()
        meta_res = anon_client.get(f'/api/sharing/public/{token}/')
        assert meta_res.status_code == 403
        assert "revoked" in str(meta_res.json()).lower()

    def test_expiration_timestamp_enforcement(self):
        # Create expired grant
        past_time = datetime.now(timezone.utc) - timedelta(hours=1)
        grant = ShareGrant.objects.create(
            document=self.doc,
            owner=self.owner,
            token_hash=ShareGrant.hash_token("expired_token"),
            permission='view',
            expires_at=past_time
        )

        anon_client = APIClient()
        res = anon_client.get('/api/sharing/public/expired_token/')
        assert res.status_code == 403
        assert "expired" in str(res.json()).lower()

    def test_user_to_user_sharing(self):
        res = self.client_owner.post('/api/sharing/grants/', {
            'document_id': str(self.doc.id),
            'share_type': 'user',
            'shared_with_email': 'recipient@lifevault.local',
            'permission': 'view'
        })
        assert res.status_code == 201

        # Recipient sees shared document in list
        rec_list = self.client_recipient.get('/api/sharing/shared-with-me/')
        assert rec_list.status_code == 200
        assert len(rec_list.json()) == 1
        assert rec_list.json()[0]['document_title'] == "House Rental Agreement"
