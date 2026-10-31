import io
import pytest
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from accounts.models import User
from documents.models import Document, DocumentCategory, DocumentVersion, StorageObject
from documents.storage_service import VaultStorageService
from encryption.crypto_service import VaultCryptoService, FileDecryptionError

# Valid mock file payloads with authentic magic headers
VALID_PDF_BYTES = b"%PDF-1.5 Mock PDF content for LifeVault testing\n%%EOF"
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
VALID_TXT_BYTES = b"Plaintext personal notes and document records."

@pytest.mark.django_db
class TestDocumentManagementAndEncryption:

    def setup_method(self):
        self.user_a = User.objects.create_user(email="alice@lifevault.local", password="StrongPassword123!")
        self.user_b = User.objects.create_user(email="bob@lifevault.local", password="StrongPassword123!")
        
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)

    def test_document_upload_and_aes_gcm_encryption(self):
        # 1. Upload valid PDF
        file = SimpleUploadedFile("passport.pdf", VALID_PDF_BYTES, content_type="application/pdf")
        category = DocumentCategory.objects.get(name="identity")

        res = self.client_a.post('/api/documents/', {
            'file': file,
            'title': 'Alice International Passport',
            'category_id': str(category.id),
            'tags': ['travel', 'passport'],
            'issuer': 'Department of State',
            'expiry_date': '2030-05-15'
        }, format='multipart')

        assert res.status_code == 201
        data = res.json()
        doc_id = data['id']
        assert data['title'] == 'Alice International Passport'
        assert data['mime_type'] == 'application/pdf'
        assert data['current_version'] == 1
        assert data['file_size'] == len(VALID_PDF_BYTES)

        # 2. Verify StorageObject contains encrypted ciphertext and NOT plaintext
        doc = Document.objects.get(id=doc_id)
        storage_obj = doc.current_storage_object
        assert storage_obj.is_encrypted is True
        assert storage_obj.encryption_algorithm == 'AES-256-GCM'
        assert len(storage_obj.encryption_nonce) == 24 # 12 bytes hex-encoded

        storage_path = VaultStorageService.get_storage_root() / storage_obj.storage_path
        stored_bytes = storage_path.read_bytes()
        assert stored_bytes != VALID_PDF_BYTES # Must be encrypted
        assert b"%PDF-1.5" not in stored_bytes # No plaintext leak in ciphertext

        # 3. Download document and verify decrypted bytes match original
        download_res = self.client_a.get(f'/api/documents/{doc_id}/download/')
        assert download_res.status_code == 200
        assert download_res.content == VALID_PDF_BYTES

    def test_file_signature_validation_rejects_spoofed_content(self):
        # File has .pdf extension but actually contains arbitrary non-PDF bytes
        fake_pdf = SimpleUploadedFile("fake.pdf", b"NOT A REAL PDF FILE HEADER", content_type="application/pdf")
        res = self.client_a.post('/api/documents/', {'file': fake_pdf}, format='multipart')
        assert res.status_code == 400
        assert "File contents do not match any permitted document signature" in str(res.json())

    def test_path_traversal_sanitization(self):
        # Attempt malicious filename
        traversal_file = SimpleUploadedFile("../../../etc/passwd.txt", VALID_TXT_BYTES, content_type="text/plain")
        res = self.client_a.post('/api/documents/', {'file': traversal_file}, format='multipart')
        assert res.status_code == 201
        data = res.json()
        # Filename must be sanitized
        assert ".." not in data['original_filename']
        assert "/" not in data['original_filename']
        assert "\\" not in data['original_filename']

    def test_object_level_authorization_cross_user_isolation(self):
        # Alice uploads a document
        file = SimpleUploadedFile("secret_alice.txt", VALID_TXT_BYTES, content_type="text/plain")
        res_upload = self.client_a.post('/api/documents/', {'file': file, 'title': 'Secret Document'}, format='multipart')
        doc_id = res_upload.json()['id']

        # Bob attempts to retrieve Alice's document metadata -> 403 Forbidden
        res_bob_get = self.client_b.get(f'/api/documents/{doc_id}/')
        assert res_bob_get.status_code == 403

        # Bob attempts to download Alice's document -> 403 Forbidden
        res_bob_dl = self.client_b.get(f'/api/documents/{doc_id}/download/')
        assert res_bob_dl.status_code == 403

        # Bob attempts to delete Alice's document -> 403 Forbidden
        res_bob_del = self.client_b.delete(f'/api/documents/{doc_id}/')
        assert res_bob_del.status_code == 403

    def test_tampered_ciphertext_detection(self):
        # Upload valid document
        file = SimpleUploadedFile("tamper_test.txt", VALID_TXT_BYTES, content_type="text/plain")
        res = self.client_a.post('/api/documents/', {'file': file}, format='multipart')
        doc_id = res.json()['id']

        doc = Document.objects.get(id=doc_id)
        storage_path = VaultStorageService.get_storage_root() / doc.current_storage_object.storage_path
        
        # Maliciously flip a byte in the stored ciphertext on disk
        ciphertext = bytearray(storage_path.read_bytes())
        ciphertext[5] ^= 0xFF
        storage_path.write_bytes(bytes(ciphertext))

        # Attempt to retrieve plaintext directly from service -> must raise FileDecryptionError (AES-GCM tag mismatch)
        with pytest.raises(FileDecryptionError):
            VaultStorageService.retrieve_plaintext(doc.current_storage_object)

    def test_document_versioning_and_restore(self):
        # 1. Upload initial version (v1)
        file_v1 = SimpleUploadedFile("contract_v1.txt", b"Version 1 Contract Terms", content_type="text/plain")
        res_v1 = self.client_a.post('/api/documents/', {'file': file_v1, 'title': 'Employment Agreement'}, format='multipart')
        doc_id = res_v1.json()['id']

        # 2. Upload revised version (v2)
        file_v2 = SimpleUploadedFile("contract_v2.txt", b"Version 2 Revised Terms with Higher Compensation", content_type="text/plain")
        res_v2 = self.client_a.post(f'/api/documents/{doc_id}/versions/', {
            'file': file_v2,
            'version_notes': 'Salary increment amendment'
        }, format='multipart')
        assert res_v2.status_code == 201
        assert res_v2.json()['version_number'] == 2

        # Verify Document now reflects current version = 2
        doc_detail = self.client_a.get(f'/api/documents/{doc_id}/').json()
        assert doc_detail['current_version'] == 2

        # 3. Download historical v1
        dl_v1 = self.client_a.get(f'/api/documents/{doc_id}/versions/1/download/')
        assert dl_v1.status_code == 200
        assert dl_v1.content == b"Version 1 Contract Terms"

        # 4. Download current v2
        dl_v2 = self.client_a.get(f'/api/documents/{doc_id}/download/')
        assert dl_v2.status_code == 200
        assert dl_v2.content == b"Version 2 Revised Terms with Higher Compensation"

        # 5. Restore historical v1 as active version
        restore_res = self.client_a.post(f'/api/documents/{doc_id}/versions/1/restore/')
        assert restore_res.status_code == 200

        # Now active download delivers v1 content
        dl_active = self.client_a.get(f'/api/documents/{doc_id}/download/')
        assert dl_active.content == b"Version 1 Contract Terms"

    def test_soft_delete_and_trash_restoration(self):
        file = SimpleUploadedFile("trash_test.txt", VALID_TXT_BYTES, content_type="text/plain")
        res = self.client_a.post('/api/documents/', {'file': file, 'title': 'Disposable Record'}, format='multipart')
        doc_id = res.json()['id']

        # Move to trash
        del_res = self.client_a.delete(f'/api/documents/{doc_id}/')
        assert del_res.status_code == 200

        # Not visible in standard list
        list_res = self.client_a.get('/api/documents/').json()
        assert not any(d['id'] == doc_id for d in list_res)

        # Visible in trash list
        trash_res = self.client_a.get('/api/documents/trash/').json()
        assert any(d['id'] == doc_id for d in trash_res)

        # Restore from trash
        restore_res = self.client_a.post(f'/api/documents/{doc_id}/restore/')
        assert restore_res.status_code == 200

        # Reappears in standard list
        active_res = self.client_a.get('/api/documents/').json()
        assert any(d['id'] == doc_id for d in active_res)
