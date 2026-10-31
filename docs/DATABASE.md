# LifeVault Database Architecture & ER Diagram

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    User ||--o{ UserProfile : "has profile"
    User ||--o{ Document : "owns"
    User ||--o{ DocumentTag : "creates"
    User ||--o{ ShareGrant : "grants/receives"
    User ||--o{ TrustedContact : "designates"
    User ||--o{ Notification : "receives"
    User ||--o{ AuditEvent : "acts as"

    DocumentCategory ||--o{ Document : "categorizes"
    Document ||--o{ DocumentVersion : "maintains versions"
    Document ||--o{ DocumentReminder : "has scheduled reminders"
    Document ||--o{ ShareGrant : "shared via"
    Document }o--o{ DocumentTag : "tagged with"

    StorageObject ||--o{ Document : "current file"
    StorageObject ||--o{ DocumentVersion : "historical file"

    ShareGrant ||--o{ ShareAccessLog : "records access"

    TrustedContact ||--o{ EmergencyAccessPolicy : "included in"
    EmergencyAccessPolicy ||--o{ EmergencyAccessRequest : "triggers"
    EmergencyAccessPolicy }o--o{ Document : "permits access to"

    User {
        uuid id PK
        string email UK
        string full_name
        boolean is_verified
        boolean two_factor_enabled
        string two_factor_secret
        datetime created_at
        datetime updated_at
    }

    UserProfile {
        id int PK
        uuid user_id FK
        string phone
        string timezone
        bigint storage_used_bytes
        bigint storage_limit_bytes
        boolean notification_email_enabled
    }

    DocumentCategory {
        uuid id PK
        string name UK
        string display_name
        string description
        string icon
        boolean is_system
    }

    DocumentTag {
        uuid id PK
        uuid user_id FK
        string name
        string color
    }

    StorageObject {
        uuid id PK
        string storage_path UK
        bigint file_size
        string sha256_hash
        string mime_type
        string encryption_nonce
        string encryption_algorithm
        boolean is_encrypted
        datetime created_at
    }

    Document {
        uuid id PK
        uuid owner_id FK
        uuid category_id FK
        uuid current_storage_object_id FK
        string title
        text description
        string original_filename
        string mime_type
        int current_version
        date issue_date
        date expiry_date
        string issuer
        string reference_number
        boolean is_archived
        boolean is_deleted
        datetime deleted_at
        datetime created_at
        datetime updated_at
    }

    DocumentVersion {
        uuid id PK
        uuid document_id FK
        uuid storage_object_id FK
        uuid uploaded_by_id FK
        int version_number
        text version_notes
        bigint file_size
        string sha256_hash
        datetime created_at
    }

    DocumentReminder {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        int reminder_days_before
        boolean is_resolved
        datetime resolved_at
        datetime created_at
    }

    Notification {
        uuid id PK
        uuid user_id FK
        uuid document_id FK
        string title
        text message
        string notification_type
        boolean is_read
        datetime read_at
        string deduplication_key UK
        datetime created_at
    }

    ShareGrant {
        uuid id PK
        uuid document_id FK
        uuid owner_id FK
        uuid shared_with_id FK
        string token_hash UK
        string permission
        datetime expires_at
        int max_downloads
        int download_count
        boolean is_revoked
        datetime revoked_at
        datetime created_at
    }

    ShareAccessLog {
        uuid id PK
        uuid share_grant_id FK
        uuid accessed_by_id FK
        string ip_address
        string user_agent
        string action
        boolean success
        datetime accessed_at
    }

    TrustedContact {
        uuid id PK
        uuid owner_id FK
        string contact_name
        string contact_email
        string phone
        string relationship
        boolean is_verified
        datetime created_at
    }

    EmergencyAccessPolicy {
        uuid id PK
        uuid owner_id FK
        uuid trusted_contact_id FK
        int waiting_period_hours
        boolean can_access_all
        boolean is_active
        datetime created_at
    }

    EmergencyAccessRequest {
        uuid id PK
        uuid policy_id FK
        string status
        text trigger_reason
        datetime requested_at
        datetime cancellation_deadline
        datetime approved_at
        datetime expires_at
    }

    AuditEvent {
        uuid id PK
        uuid actor_id FK
        string action
        string target_type
        string target_id
        string ip_address
        string user_agent
        jsonb details
        string prev_hash
        string current_hash
        datetime timestamp
    }
```

---

## 2. Key Schema Decisions

1. **UUID Primary Keys for Sensitive Resources**:
   - Primary resources (`User`, `Document`, `DocumentVersion`, `StorageObject`, `ShareGrant`, `AuditEvent`) use version 4 UUIDs rather than sequential auto-incrementing integers.
   - **Security Reason**: Sequential IDs allow enumeration attacks and Insecure Direct Object Reference (IDOR) probing. UUIDs prevent attackers from discovering document volumes or guessing entity identifiers.

2. **StorageObject Abstraction**:
   - Decouples the logical metadata of a `Document` from its physical storage artifact.
   - When a new version is uploaded, a new `StorageObject` is created with its own unique random storage path, encryption nonce, and SHA-256 hash. The `Document` points to the current active `StorageObject`, while all historical versions link to their respective `StorageObjects`.

3. **Soft Deletion with Retention Period**:
   - `Document.is_deleted` and `Document.deleted_at` allow documents to be retained in a "Trash Bin" for a configurable window (e.g., 30 days) before permanent cryptographic shredding.

4. **Chained-Hash Audit Trail**:
   - `AuditEvent` records form a cryptographic Merkle-like chain:
     $$\text{current\_hash} = \text{SHA-256}(\text{prev\_hash} \,||\, \text{timestamp} \,||\, \text{actor\_id} \,||\, \text{action} \,||\, \text{target\_id} \,||\, \text{details})$$
   - This prevents silent row alterations or truncation by malicious actors.
