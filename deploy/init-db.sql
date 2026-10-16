-- Workforce Vision Platform PostgreSQL Initial Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    shift_start TIME NOT NULL DEFAULT '09:00:00',
    shift_end TIME NOT NULL DEFAULT '18:00:00',
    retention_days INT NOT NULL DEFAULT 90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users & RBAC
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'manager', -- owner, manager, observer
    two_factor_secret VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sites / Branches
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cameras
CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'general', -- entrance, exit, general
    status VARCHAR(50) NOT NULL DEFAULT 'offline', -- online, offline
    fps INT NOT NULL DEFAULT 0,
    latency_ms INT NOT NULL DEFAULT 0,
    last_frame_at TIMESTAMPTZ,
    rtsp_address_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    consent_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- granted, denied, revoked, pending
    consent_date TIMESTAMPTZ,
    enrollment_status VARCHAR(50) NOT NULL DEFAULT 'none', -- enrolled, partial, none
    enrollment_samples INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Biometric Consents
CREATE TABLE IF NOT EXISTS consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Face Embeddings (128-d OpenCV SFace)
CREATE TABLE IF NOT EXISTS face_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    embedding vector(128) NOT NULL,
    quality_score FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance Events
CREATE TABLE IF NOT EXISTS attendance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- enter, exit, seen
    confidence FLOAT NOT NULL,
    snapshot_path TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    feedback BOOLEAN
);

-- Attendance Days Aggregations
CREATE TABLE IF NOT EXISTS attendance_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'absent', -- present, absent, missing
    late_minutes INT NOT NULL DEFAULT 0,
    total_present_minutes INT NOT NULL DEFAULT 0,
    UNIQUE(employee_id, date)
);

-- Unknown Faces
CREATE TABLE IF NOT EXISTS unknown_faces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    snapshot_path TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolution VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, linked, guest, ignored
    resolved_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ
);

-- Immutable Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce Immutability on Audit Logs: Prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log yozuvlarini tahrirlash yoki o''chirish qat''iyan man etiladi!';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_audit_log ON audit_logs;
CREATE TRIGGER trg_immutable_audit_log
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- Ask Query Logs
CREATE TABLE IF NOT EXISTS ask_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    question TEXT NOT NULL,
    functions_called JSONB,
    response TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
