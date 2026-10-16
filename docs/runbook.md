# Workforce Vision Platform (WVP) - Operations Runbook

## 1. Encrypted Database Backups (`pg_dump` + `age`)

Biometric data in PostgreSQL must be encrypted both at rest and in transit. Standard unencrypted backups are strictly prohibited.

### 1.1 Generate Age Key Pair (Admin Workstation)
```bash
# Generate backup recipient key pair
age-keygen -o backup_key.txt
# Public key format: age1...
```

### 1.2 Automated Encrypted Nightly Dump
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/wfv"
DATE=$(date +%Y%m%d_%H%M%S)
RECIPIENT="age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"

mkdir -p "$BACKUP_DIR"

# Stream pg_dump directly into age cipher stream
docker exec -t wfv-postgres pg_dump -U wfv_app -d wfv_db --format=custom \
  | age -r "$RECIPIENT" > "$BACKUP_DIR/wfv_backup_${DATE}.dump.age"

# Enforce 30-day retention policy (ZRU-1125 consent period)
find "$BACKUP_DIR" -type f -name "wfv_backup_*.dump.age" -mtime +30 -delete

echo "[OK] Backup completed and encrypted: $BACKUP_DIR/wfv_backup_${DATE}.dump.age"
```

### 1.3 Disaster Recovery Restore Drill
```bash
# 1. Decrypt archive using private key
age --decrypt -i backup_key.txt wfv_backup_20261016_120000.dump.age > restored.dump

# 2. Restore into fresh database instance
docker exec -i wfv-postgres pg_restore -U wfv_app -d wfv_db --clean --if-exists < restored.dump

# 3. Clean plaintext dump file immediately
shred -u restored.dump
```

---

## 2. Biometric Consent Revocation Verification SQL

To legally verify that an employee's face embeddings and snapshots were completely wiped upon consent revocation:

```sql
-- Replace with employee UUID to verify:
\set target_emp_id '00000000-0000-0000-0000-000000000000'

-- 1. Ensure 0 face embeddings exist
SELECT COUNT(*) AS active_embeddings 
FROM face_embeddings 
WHERE employee_id = :'target_emp_id';
-- MUST RETURN: 0

-- 2. Ensure all event snapshot paths are NULL
SELECT COUNT(*) AS remaining_snapshot_paths 
FROM attendance_events 
WHERE employee_id = :'target_emp_id' 
  AND snapshot_path IS NOT NULL;
-- MUST RETURN: 0

-- 3. Verify consent status is 'revoked'
SELECT id, first_name, last_name, consent_status, enrollment_status, enrollment_samples 
FROM employees 
WHERE id = :'target_emp_id';
-- MUST RETURN: consent_status='revoked', enrollment_status='none', enrollment_samples=0

-- 4. Verify immutable audit log record exists
SELECT id, action, details, prev_hash, row_hash, created_at 
FROM audit_logs 
WHERE entity_id = :'target_emp_id'::text 
  AND action = 'consent_revoked_biometrics_purged';
```

---

## 3. Secret & Key Rotation Procedure

### 3.1 Rotating JWT Secret
1. Generate new 32-byte hex secret:
   ```bash
   openssl rand -hex 32
   ```
2. Update `JWT_SECRET` in `.env`.
3. Restart `core-api`:
   ```bash
   docker compose restart core-api
   ```
4. *Effect:* Existing access tokens expire within 15 minutes. Users refresh sessions automatically via rotated refresh tokens in their HttpOnly cookie.

### 3.2 Rotating AES-256-GCM Encryption Key (Kamera parollari)
1. Read existing camera RTSP addresses with old key.
2. Re-encrypt with new 64-hex-char AES key.
3. Update `AES_ENCRYPTION_KEY` in `.env` and restart service.

---

## 4. Zero-Downtime Rolling Update

```bash
# 1. Pull updated container images
docker compose pull

# 2. Run database migrations first
docker compose run --rm core-api-migrate

# 3. Gracefully recreate backend microservices
docker compose up -d --no-deps --build core-api vision-worker

# 4. Verify health endpoints
curl -f http://127.0.0.1/ready
```
