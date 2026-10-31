# LifeVault Security Model & Threat Assessment

## 1. Zero-Trust Security Philosophy

LifeVault assumes an adversarial environment where network perimeters can be traversed, shared links can be forwarded, and underlying database snapshots may be subject to compromise. To protect sensitive personal, financial, academic, and legal records, the system applies defense-in-depth security principles.

```
+--------------------------------------------------------------------------+
|                        Client Layer (React / SPA)                        |
|   Strict Input Sanitization • HTTPS Only • No Plaintext Secrets in URL   |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                  Gateway & Transport Security Layer                      |
|       CORS Origin Whitelisting • HSTS • X-Content-Type-Options: nosniff   |
|         X-Frame-Options: DENY • API Throttling (Anon / Auth tiers)        |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                     Application Authorization Layer                      |
|       Object-Level Permissions (django-guardian / explicit ownership)    |
|   Random UUID4 Identifiers (Anti-IDOR) • Session / Token Invalidation    |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                 Application-Level Cryptographic Engine                   |
|        AES-256-GCM AEAD (Authenticated Encryption with Associated Data)  |
|            Fresh 96-bit (12-byte) Cryptographic Nonce Per File            |
|       Integrity Verification via Ciphertext Tag & Plaintext SHA-256       |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                       Private Storage Isolation                          |
|         Non-predictable Storage Paths outside HTTP Document Root         |
|              Direct URL Access Blocked • Authenticated Streaming         |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                   Tamper-Evident Chained Audit Logging                   |
|         SHA-256 Hash Chaining: H(n) = SHA256(H(n-1) || Event_Data)      |
+--------------------------------------------------------------------------+
```

---

## 2. Threat Analysis & Mitigations

### 2.1 Insecure Direct Object References (IDOR)
- **Threat**: An attacker changes a numerical ID (e.g., `/documents/14/` to `/documents/15/`) to access other users' personal documents.
- **Mitigation**:
  1. All models use non-sequential UUIDv4 primary keys.
  2. Every endpoint explicitly checks ownership (`owner=request.user`) in the database query.
  3. Attempting to access another user's document produces an HTTP 403 Forbidden or 404 Not Found response and logs a security event.

### 2.2 Unauthenticated File Exposure via Static/Media URLs
- **Threat**: Uploaded files saved in standard `/media/` directories can be discovered or downloaded if a web server is misconfigured.
- **Mitigation**:
  1. Files are stored in an isolated filesystem location (`storage/private/`) outside the HTTP document root.
  2. The web server never serves files directly. All requests must pass through Django authenticated view controllers (`/api/documents/<uuid>/download/`).
  3. Stored files are encrypted ciphertexts; even direct file reads on the server yield only high-entropy ciphertext.

### 2.3 Ciphertext Tampering & Bit-Flipping
- **Threat**: An attacker with filesystem access modifies bytes in an encrypted document.
- **Mitigation**:
  1. LifeVault uses AES-256 in Galois/Counter Mode (GCM), an authenticated encryption mode (AEAD).
  2. A 16-byte authentication tag is generated during encryption.
  3. Decryption automatically fails with `InvalidTag` if any byte of the ciphertext or tag is modified.

### 2.4 External Link Leaks & Database Compromise
- **Threat**: An external temporary share link URL is leaked or an attacker accesses a database backup.
- **Mitigation**:
  1. Link tokens are generated using `secrets.token_urlsafe(32)`.
  2. The plaintext token is never stored in the database. Only `SHA-256(token)` is persisted.
  3. Tokens expire automatically and can be revoked instantaneously.

### 2.5 Emergency Access Abuse
- **Threat**: A rogue contact requests emergency access to acquire sensitive documents without consent.
- **Mitigation**:
  1. Emergency requests require an explicit waiting period (e.g., 48 hours).
  2. The vault owner receives real-time email and dashboard alerts.
  3. The owner can cancel/veto the request at any time before the deadline.
  4. Access is strictly scoped to predefined documents.

---

## 3. Cryptographic Key Management & Server-Side Security

> [!IMPORTANT]
> **Server-Side Encryption vs. End-to-End Encryption (E2EE)**:
> LifeVault implements server-side authenticated encryption at the application level. Because the decryption key resides in server environment configuration (`VAULT_MASTER_KEY`), this design does not claim to be client-side end-to-end encrypted (E2EE). The server decrypts authorized requests into memory and streams plaintext over TLS to authenticated clients.

### Key Rotation Procedure
1. Generate new 256-bit base64 key: `python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"`
2. Set `VAULT_SECONDARY_KEY` in environment.
3. Run management command to re-encrypt stored artifacts under the new key.
4. Promote secondary key to `VAULT_MASTER_KEY`.
