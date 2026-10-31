# LifeVault CV & Portfolio Project Description

## Short Bullet Points (For Resume / CV)

- **LifeVault — Secure Digital Document & Personal Records Vault** *(Python, Django, React, TypeScript, Tailwind, PostgreSQL, Redis, Docker)*
  - Designed and built a zero-trust personal document vault with application-level **AES-256-GCM AEAD encryption**, generating unique 96-bit nonces per file and enforcing strict magic-header byte validation.
  - Developed granular access controls including **object-level permissions**, **hashed-token expiring share links**, download limits, and an emergency **break-glass protocol** with owner veto timers.
  - Implemented an **append-only tamper-evident audit ledger** using sequential SHA-256 cryptographic hash chaining to verify system log integrity.
  - Engineered asynchronous lifecycle alert workers with **Celery & Redis**, ensuring idempotent notification delivery through deterministic deduplication keys.
  - Wrote comprehensive automated tests (31 unit & integration tests) achieving 100% pass rate across cryptographic tampering, IDOR prevention, and version restoration.

---

## Detailed Project Summary (For Graduate School Statement of Purpose / Portfolio)

**LifeVault: A High-Assurance Secure Personal Records & Document Vault**

LifeVault addresses the vulnerability of storing critical personal records (passports, academic diplomas, medical records, and legal agreements) on unencrypted cloud storage or unauthenticated platforms. 

**Key Technical Highlights**:
1. **Authenticated Application-Level Cryptography**: Utilized the `cryptography` library to implement AES-256-GCM. Each document version is encrypted with a fresh 96-bit random nonce and stored outside the HTTP document root. The 16-byte authentication tag guarantees detection of unauthorized ciphertext tampering or corruption.
2. **Anti-IDOR & Zero-Trust Architecture**: Replaced auto-incrementing sequential integers with non-enumerable UUIDv4 primary keys and enforced object-level ownership checks across every view controller.
3. **Defense-in-Depth Sharing Mechanism**: External sharing links use cryptographically random 256-bit URL-safe tokens; the database persists only SHA-256 token digests. Access grants support download caps, expiration timestamps, and instant revocation.
4. **Emergency Break-Glass Protocol**: Solves the digital asset succession problem by enabling designated trusted contacts to request scoped access governed by mandatory waiting periods (e.g., 48 hours) and active owner veto mechanisms.
5. **Tamper-Evident Chained Audit Logging**: Every security-sensitive transaction is recorded in an immutable ledger where each row's hash cryptographically chains to its predecessor, allowing automated validation of audit log integrity.
