import os
import re
import uuid
from pathlib import Path
from django.conf import settings
from rest_framework.exceptions import ValidationError
from encryption.crypto_service import VaultCryptoService
from .models import StorageObject

# Supported magic bytes signatures
FILE_SIGNATURES = {
    'pdf': b'%PDF',
    'png': b'\x89PNG\r\n\x1a\n',
    'jpeg': b'\xff\xd8\xff',
    'docx': b'PK\x03\x04',
}

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'docx', 'txt', 'csv'}

def sanitize_filename(filename: str) -> str:
    """
    Strips directory traversal components, dangerous characters, and excessive length.
    """
    clean_name = os.path.basename(filename)
    clean_name = re.sub(r'[^a-zA-Z0-9._\- ]', '_', clean_name)
    if not clean_name or clean_name.startswith('.'):
        clean_name = f"document_{uuid.uuid4().hex[:8]}"
    return clean_name[:200]

def detect_mime_type_and_validate(file_bytes: bytes, original_filename: str) -> str:
    """
    Validates file content by verifying magic headers.
    Does not trust extension or browser-provided MIME headers alone.
    """
    if len(file_bytes) == 0:
        raise ValidationError("Uploaded file is empty (0 bytes).")

    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError(f"File size exceeds maximum allowed limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB.")

    ext = original_filename.split('.')[-1].lower() if '.' in original_filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"File extension '.{ext}' is not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # Inspect magic header
    header = file_bytes[:16]
    if header.startswith(FILE_SIGNATURES['pdf']):
        return 'application/pdf'
    elif header.startswith(FILE_SIGNATURES['png']):
        return 'image/png'
    elif header.startswith(FILE_SIGNATURES['jpeg']):
        return 'image/jpeg'
    elif header.startswith(FILE_SIGNATURES['docx']):
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    elif ext in ('txt', 'csv'):
        try:
            file_bytes[:1024].decode('utf-8')
            return 'text/plain' if ext == 'txt' else 'text/csv'
        except UnicodeDecodeError:
            raise ValidationError("File content could not be verified as valid text.")
    
    raise ValidationError("File contents do not match any permitted document signature.")


class VaultStorageService:
    @classmethod
    def get_storage_root(cls) -> Path:
        root = Path(settings.VAULT_STORAGE_ROOT).resolve()
        root.mkdir(parents=True, exist_ok=True)
        return root

    @classmethod
    def store_file(cls, file_bytes: bytes, original_filename: str, mime_type: str) -> StorageObject:
        """
        Encrypts file and writes ciphertext to private storage with a random UUID filename.
        """
        ciphertext, nonce_hex, sha256_hash = VaultCryptoService.encrypt_data(file_bytes)

        storage_root = cls.get_storage_root()
        unique_file_id = uuid.uuid4()
        storage_rel_path = f"{unique_file_id}.vault"
        storage_abs_path = (storage_root / storage_rel_path).resolve()

        # Strict path traversal check
        if not storage_abs_path.is_relative_to(storage_root):
            raise ValidationError("Path traversal attempt detected during storage operation.")

        storage_abs_path.write_bytes(ciphertext)

        storage_object = StorageObject.objects.create(
            id=unique_file_id,
            storage_path=storage_rel_path,
            file_size=len(file_bytes),
            sha256_hash=sha256_hash,
            mime_type=mime_type,
            encryption_nonce=nonce_hex,
            encryption_algorithm='AES-256-GCM',
            is_encrypted=True
        )
        return storage_object

    @classmethod
    def retrieve_plaintext(cls, storage_object: StorageObject) -> bytes:
        """
        Reads encrypted file from private storage, verifies integrity, and decrypts.
        """
        storage_root = cls.get_storage_root()
        file_path = (storage_root / storage_object.storage_path).resolve()

        if not file_path.is_relative_to(storage_root) or not file_path.exists():
            raise FileNotFoundError("Storage artifact not found in vault storage.")

        ciphertext = file_path.read_bytes()
        return VaultCryptoService.decrypt_data(
            ciphertext=ciphertext,
            nonce_hex=storage_object.encryption_nonce,
            expected_hash=storage_object.sha256_hash
        )

    @classmethod
    def delete_file(cls, storage_object: StorageObject):
        """
        Securely removes file from storage.
        """
        storage_root = cls.get_storage_root()
        file_path = (storage_root / storage_object.storage_path).resolve()
        if file_path.is_relative_to(storage_root) and file_path.exists():
            file_path.unlink(missing_ok=True)
        storage_object.delete()
