# LifeVault Interview & Live Demonstration Checklist

Use this checklist to demonstrate the system end-to-end in interviews or project reviews.

## Demonstration Flow

- [ ] **1. Health & Architecture Overview**
  - Point to `/api/health/` verifying database status and storage permissions.
  - Open `/api/docs/` showing interactive Swagger UI with all OpenAPI endpoints documented.

- [ ] **2. Zero-Trust Registration & 2FA**
  - Register a new account (`alice@example.com`).
  - Demonstrate password strength validator rejecting weak passwords.
  - Navigate to **Settings** -> **Two-Factor Authentication** -> Scan/enter key.
  - Log out and log back in, showing mandatory TOTP 6-digit challenge.

- [ ] **3. Document Upload & Authenticated Encryption (AES-256-GCM)**
  - Click **Upload Document**, select a real or sample PDF file.
  - Assign category ("Identity & Travel") and set an expiry date.
  - Open `storage/private/` on the server and view the newly created `.vault` file:
    - Point out that it is raw ciphertext without plaintext document headers.
  - Download the document from the UI and verify clean decryption.

- [ ] **4. Tamper Detection Proof**
  - Demonstrate that modifying or corrupting a byte in the encrypted `.vault` file causes an integrity failure (`InvalidTag`), preventing silent data modification.

- [ ] **5. Version Timeline & Safe Restoration**
  - Open document details, click **Versions**.
  - Upload a revised copy with notes ("Revised salary agreement").
  - Show the version history timeline (v1 and v2) with SHA-256 integrity hashes.
  - Restore v1 as current; show active download now serves v1 content.

- [ ] **6. Secure Link Sharing & Revocation**
  - Click **Share Document** -> Create an expiring link with `max_downloads=1`.
  - Show that the link contains a cryptographically random token, and verify in the database that only `SHA-256(token)` is stored.
  - Open the link in an incognito window -> download file once.
  - Refresh and attempt a second download -> demonstrate 403 Forbidden ("Maximum permitted download limit has been reached").
  - Click **Revoke Access** from the dashboard; verify access is immediately blocked.

- [ ] **7. Emergency Access (Break-Glass Protocol)**
  - Go to **Emergency Access** -> Add a trusted contact (`emergency@family.com`).
  - Create a policy with a 48-hour waiting period.
  - Initiate an emergency request -> show instant urgent owner notification.
  - Click **Cancel Request** from the owner dashboard -> confirm access is vetoed.

- [ ] **8. Append-Only Tamper-Evident Audit Trail**
  - Open **Audit Trail** -> view real-time log of registrations, uploads, downloads, and shares.
  - Show previous and current SHA-256 hashes linking each row.
  - Click **Re-verify Chain Integrity** -> observe validation report.
