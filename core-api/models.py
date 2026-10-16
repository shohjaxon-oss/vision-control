import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, Time, Integer, Float,
    ForeignKey, Text, JSON, UniqueConstraint, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from database import Base

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    timezone = Column(String(100), nullable=False, default="Asia/Tashkent")
    shift_start = Column(Time, nullable=False, default=datetime.strptime("09:00:00", "%H:%M:%S").time())
    shift_end = Column(Time, nullable=False, default=datetime.strptime("18:00:00", "%H:%M:%S").time())
    retention_days = Column(Integer, nullable=False, default=90)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="manager") # owner, manager, observer
    two_factor_secret = Column(String(255), nullable=True) # AES encrypted TOTP secret
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("role IN ('owner', 'manager', 'observer')", name="chk_user_role"),
    )

class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(50), nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("email", "ip_address", name="uq_login_attempt_email_ip"),
    )

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    family_id = Column(UUID(as_uuid=True), nullable=False, index=True) # For token family rotation detection
    is_revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Site(Base):
    __tablename__ = "sites"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Camera(Base):
    __tablename__ = "cameras"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="general", nullable=False) # entrance, exit, general
    status = Column(String(50), default="offline", nullable=False) # online, offline
    fps = Column(Integer, default=0, nullable=False)
    latency_ms = Column(Integer, default=0, nullable=False)
    last_frame_at = Column(DateTime(timezone=True), nullable=True)
    rtsp_address_encrypted = Column(Text, nullable=False)
    position = Column(JSON, nullable=True, default=lambda: {"x": 0.0, "y": 0.0, "z": 0.0, "yaw": 0.0, "fov": 90.0, "floor": 1})
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("type IN ('entrance', 'exit', 'general')", name="chk_camera_type"),
        CheckConstraint("status IN ('online', 'offline')", name="chk_camera_status"),
    )

class Employee(Base):
    __tablename__ = "employees"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    position = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=True)
    consent_status = Column(String(50), default="pending", nullable=False) # granted, denied, revoked, pending
    consent_date = Column(DateTime(timezone=True), nullable=True)
    enrollment_status = Column(String(50), default="none", nullable=False) # enrolled, partial, none
    enrollment_samples = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("consent_status IN ('granted', 'denied', 'revoked', 'pending')", name="chk_employee_consent_status"),
        CheckConstraint("enrollment_status IN ('enrolled', 'partial', 'none')", name="chk_employee_enrollment_status"),
        Index("ix_employees_org_name", "organization_id", "first_name", "last_name"),
    )

class ConsentDocument(Base):
    __tablename__ = "consent_documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    granted = Column(Boolean, nullable=False)
    version = Column(String(20), default="1.0", nullable=False)
    method = Column(String(50), default="electronic", nullable=False) # paper, electronic
    document_ref = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    granted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("method IN ('paper', 'electronic')", name="chk_consent_method"),
    )

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding = Column(Vector(128), nullable=False) # 128-d OpenCV SFace
    quality_score = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_face_embeddings_org_emp", "organization_id", "employee_id"),
    )

class Shift(Base):
    __tablename__ = "shifts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class AttendanceEvent(Base):
    __tablename__ = "attendance_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String(50), nullable=False) # enter, exit, seen
    confidence = Column(Float, nullable=False)
    snapshot_path = Column(Text, nullable=True) # Path to encrypted/stored snapshot on disk
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    reviewed = Column(Boolean, default=False, nullable=False)
    feedback = Column(Boolean, nullable=True)

    __table_args__ = (
        CheckConstraint("event_type IN ('enter', 'exit', 'seen')", name="chk_att_event_type"),
        Index("ix_att_events_emp_time", "employee_id", "occurred_at"),
        Index("ix_att_events_cam_time", "camera_id", "occurred_at"),
        Index("ix_att_events_org_time", "organization_id", "occurred_at"),
    )

class AttendanceDay(Base):
    __tablename__ = "attendance_days"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    first_seen = Column(DateTime(timezone=True), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="absent", nullable=False) # present, absent, missing
    late_minutes = Column(Integer, default=0, nullable=False)
    total_present_minutes = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_attendance_days_employee_date"),
        CheckConstraint("status IN ('present', 'absent', 'missing')", name="chk_att_day_status"),
        Index("ix_att_days_org_date", "organization_id", "date"),
    )

class UnknownFace(Base):
    __tablename__ = "unknown_faces"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True, index=True)
    snapshot_path = Column(Text, nullable=False)
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    resolution = Column(String(50), default="pending", nullable=False) # pending, linked, guest, ignored
    resolved_employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("resolution IN ('pending', 'linked', 'guest', 'ignored')", name="chk_unknown_resolution"),
        Index("ix_unknown_faces_org_res", "organization_id", "resolution", "occurred_at"),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    prev_hash = Column(String(64), nullable=True) # SHA-256 chained hash
    row_hash = Column(String(64), nullable=True)  # SHA-256 row verification
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

class AskLog(Base):
    __tablename__ = "ask_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    question = Column(Text, nullable=False)
    functions_called = Column(JSON, nullable=True)
    response = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True) # Real confidence from queried events, or null
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
