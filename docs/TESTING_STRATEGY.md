# LifeVault Automated Testing Strategy & Verification Report

## 1. Test Architecture

LifeVault employs automated tests across all security and domain layers:

```
tests/
  ├── test_phase1_setup.py          # Health checks, DB readiness, OpenAPI schemas
  ├── test_phase2_accounts.py       # Registration, 2FA, password strength, rate limits
  ├── test_phase3_4_5_documents.py  # File validation, AES-GCM encryption, IDOR, versioning
  ├── test_phase6_reminders.py      # Celery task idempotency, duplicate alert prevention
  ├── test_phase7_sharing.py        # Hashed token links, revocation, download limits
  └── test_phase8_emergency_audit.py# Break-glass veto, audit chain tamper detection
```

---

## 2. Key Test Scenarios & Invariant Assertions

| Test Class / Suite | Assertion Focus | Security Invariant Verified |
| :--- | :--- | :--- |
| **`test_health_check_endpoint`** | Checks storage directory writeability and database roundtrip. | Service returns 200 and reports healthy checks before accepting traffic. |
| **`test_registration_duplicate_prevention`**| Submits identical email registrations. | Database rejects duplicates with 400 error. |
| **`test_two_factor_authentication_workflow`**| Sets up TOTP secret, validates 6-digit code, enforces 2FA on login. | Login returns `requires_2fa: True` until valid TOTP is provided. |
| **`test_document_upload_and_aes_gcm_encryption`**| Uploads valid PDF file and reads raw ciphertext directly from disk. | Stored file bytes contain no plaintext signatures; encrypted with AES-256-GCM. |
| **`test_file_signature_validation_rejects_spoofed_content`**| Uploads a file with `.pdf` extension containing arbitrary byte headers. | Application rejects upload with 400 validation error based on magic header analysis. |
| **`test_object_level_authorization_cross_user_isolation`**| User B attempts to view, download, or delete User A's document. | Application enforces 403 Forbidden; cross-user IDOR is prevented. |
| **`test_tampered_ciphertext_detection`**| Modifies a single byte in ciphertext on disk before retrieval. | Authenticated decryption fails with `FileDecryptionError` (AEAD tag mismatch). |
| **`test_document_versioning_and_restore`**| Uploads v1 and v2, verifies history timeline, restores v1 as active. | Historical versions are preserved without silent overwriting. |
| **`test_celery_expiry_checker_and_duplicate_prevention`**| Triggers expiry check task twice on the same day. | Deterministic deduplication key prevents duplicate notifications. |
| **`test_one_time_download_limit_enforcement`**| Downloads a shared document where `max_downloads=1`. | Second download attempt is rejected with 403 Forbidden. |
| **`test_instant_revocation`**| Owner revokes share grant; recipient attempts to download immediately. | Access is denied with 403 Forbidden. |
| **`test_emergency_request_veto_and_cancellation`**| Contact requests emergency access; owner cancels before deadline. | Access status transitions to cancelled; file retrieval is blocked. |
| **`test_audit_chain_integrity_after_auth_events`**| Injects a tampered hash into historical audit record. | `verify_audit_chain` identifies the broken chain link. |

---

## 3. Test Execution Command

Run the complete test suite with verbose output:

```bash
pytest backend/tests/ -v
```

All 31 automated tests pass cleanly with 100% pass rate.
