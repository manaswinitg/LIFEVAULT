# LifeVault Backup and Disaster Recovery Strategy

## 1. Backup Components

A complete LifeVault backup consists of two decoupled assets:
1. **Relational Database (`PostgreSQL` / `SQLite`)**: Contains users, metadata, categories, version pointers, share grants, and audit chains.
2. **Encrypted Storage Artifacts (`storage/private/`)**: Contains AES-256-GCM ciphertexts identified by UUID filenames.

---

## 2. Backup Procedures

### 2.1 Database Dump (PostgreSQL)
```bash
# Production PostgreSQL backup
pg_dump -U vault_user -h localhost -d lifevault_db -F c -b -v -f /backups/lifevault_db_$(date +%Y%m%d_%H%M%S).dump
```

### 2.2 Storage Volume Archive
```bash
# Archive encrypted storage artifacts
tar -czvf /backups/vault_storage_$(date +%Y%m%d_%H%M%S).tar.gz -C storage/ private/
```

### 2.3 Master Key Escrow
The `VAULT_MASTER_KEY` environment variable must be backed up securely in an isolated offline password manager or hardware security module (HSM). Without this key, stored encrypted artifacts cannot be recovered.

---

## 3. Restoration Procedure

1. **Restore Relational Database**:
   ```bash
   pg_restore -U vault_user -h localhost -d lifevault_db -v /backups/lifevault_db_YYYYMMDD_HHMMSS.dump
   ```
2. **Extract Storage Artifacts**:
   ```bash
   tar -xzvf /backups/vault_storage_YYYYMMDD_HHMMSS.tar.gz -C storage/
   ```
3. **Verify Integrity**:
   Run the audit chain verification endpoint:
   ```bash
   curl -H "Authorization: Token <USER_TOKEN>" http://localhost:8000/api/audit/verify/
   ```
