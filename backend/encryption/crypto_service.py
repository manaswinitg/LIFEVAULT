import os
import base64
import hashlib
from pathlib import Path
from django.conf import settings
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

class CryptoServiceError(Exception):
    """Base exception for cryptographic operations."""
    pass

class IntegrityVerificationError(CryptoServiceError):
    """Raised when SHA-256 hash or AEAD authentication tag validation fails."""
    pass

class FileDecryptionError(CryptoServiceError):
    """Raised when ciphertext cannot be decrypted due to corruption or invalid key/nonce."""
    pass


class VaultCryptoService:
    """
    AES-256-GCM Authenticated Encryption Service.
    
    Guarantees:
    - 256-bit symmetric encryption key loaded from environment secrets.
    - Unique cryptographically secure 96-bit (12-byte) nonce per encryption operation.
    - GCM authentication tag automatically validates against unauthorized ciphertext tampering.
    - Plaintext SHA-256 integrity hash verification.
    """

    @classmethod
    def _get_master_key(cls) -> bytes:
        raw_key = getattr(settings, 'VAULT_MASTER_KEY', None)
        if not raw_key:
            raise CryptoServiceError("VAULT_MASTER_KEY is not configured in settings.")
        
        try:
            key_bytes = base64.b64decode(raw_key)
            if len(key_bytes) != 32:
                raise ValueError("Key length must be exactly 32 bytes (256 bits).")
            return key_bytes
        except Exception as e:
            raise CryptoServiceError(f"Invalid master key configuration: {str(e)}")

    @classmethod
    def compute_sha256(cls, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    @classmethod
    def encrypt_data(cls, plaintext_bytes: bytes) -> tuple[bytes, str, str]:
        """
        Encrypts plaintext bytes using AES-256-GCM.
        Returns:
            (ciphertext: bytes, nonce_hex: str, sha256_hash: str)
        """
        if not isinstance(plaintext_bytes, bytes):
            raise TypeError("plaintext_bytes must be of type bytes")

        key = cls._get_master_key()
        aesgcm = AESGCM(key)

        # 96-bit unique nonce for GCM
        nonce = os.urandom(12)
        plaintext_hash = cls.compute_sha256(plaintext_bytes)

        # Ciphertext contains the appended 16-byte authentication tag
        ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, associated_data=None)
        nonce_hex = nonce.hex()

        return ciphertext, nonce_hex, plaintext_hash

    @classmethod
    def decrypt_data(cls, ciphertext: bytes, nonce_hex: str, expected_hash: str = None) -> bytes:
        """
        Decrypts ciphertext using AES-256-GCM and validates data integrity.
        Raises:
            FileDecryptionError: if ciphertext is corrupted or tag verification fails.
            IntegrityVerificationError: if decrypted bytes do not match expected_hash.
        """
        key = cls._get_master_key()
        aesgcm = AESGCM(key)

        try:
            nonce = bytes.fromhex(nonce_hex)
            if len(nonce) != 12:
                raise ValueError("Nonce must be 12 bytes.")
            
            decrypted_plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
        except InvalidTag:
            raise FileDecryptionError("Ciphertext integrity verification failed! Authenticated tag mismatch.")
        except Exception as e:
            raise FileDecryptionError(f"Decryption failed: {str(e)}")

        if expected_hash:
            actual_hash = cls.compute_sha256(decrypted_plaintext)
            if actual_hash.lower() != expected_hash.lower():
                raise IntegrityVerificationError(
                    f"Integrity check failed! Expected hash {expected_hash}, computed {actual_hash}."
                )

        return decrypted_plaintext
