import uuid
from datetime import datetime, date, time
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, EmailStr

# Auth Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization_id: Optional[str] = None
    is_active: bool = True

class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    user: Optional[UserResponse] = None
    requires_2fa: bool = False
    challenge_token: Optional[str] = None

class Verify2FARequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)
    challenge_token: Optional[str] = None

class Setup2FAResponse(BaseModel):
    secret: str
    otpauth_url: str
    backup_codes: List[str]

class Confirm2FARequest(BaseModel):
    secret: str
    code: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str
    role: str = Field("manager", pattern="^(owner|manager|observer)$")

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(owner|manager|observer)$")
    is_active: Optional[bool] = None

# Organization Schemas
class OrganizationResponse(BaseModel):
    id: str
    name: str
    timezone: str
    shift_start: str
    shift_end: str
    retention_days: int

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    shift_start: Optional[str] = None # HH:MM:SS
    shift_end: Optional[str] = None   # HH:MM:SS
    retention_days: Optional[int] = Field(None, ge=1, le=365)

# Camera Schemas
class CameraPosition(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    yaw: float = 0.0
    fov: float = 90.0
    floor: int = 1

class CameraResponse(BaseModel):
    id: str
    name: str
    type: str # entrance, exit, general
    status: str # online, offline
    fps: int
    latency_ms: int
    last_frame_at: Optional[datetime] = None
    rtsp_address: str # Masked: rtsp://192.168.1.10/... (password never exposed!)
    rtsp_masked: str
    position: Optional[Dict[str, Any]] = None
    organization_id: Optional[str] = None

class CameraCreate(BaseModel):
    name: str
    type: str = Field("general", pattern="^(entrance|exit|general)$")
    rtsp_address: str
    position: Optional[CameraPosition] = None

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(entrance|exit|general)$")
    rtsp_address: Optional[str] = None
    position: Optional[CameraPosition] = None

class CameraTestRequest(BaseModel):
    name: Optional[str] = None
    rtsp_address: str
    password: Optional[str] = None

class CameraTestResponse(BaseModel):
    success: bool
    fps: int
    latency_ms: int
    message: str
    codec: Optional[str] = None

class CameraHealthResponse(BaseModel):
    status: str
    fps: int
    latency_ms: int

class LiveTicketResponse(BaseModel):
    camera_id: str
    ticket: str
    webrtc_url: str
    expires_in_seconds: int

# Employee Schemas
class EmployeeResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    position: str
    department: str
    phone: Optional[str] = None
    consent_status: str # granted, denied, revoked, pending
    consent_date: Optional[datetime] = None
    enrollment_status: str # enrolled, partial, none
    enrollment_samples: int
    is_active: bool
    created_at: datetime

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    position: str
    department: str
    phone: Optional[str] = None

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class ConsentRequest(BaseModel):
    granted: bool
    version: str = "1.0"
    method: str = Field("electronic", pattern="^(paper|electronic)$")
    document_ref: Optional[str] = None

class EnrollmentCaptureRequest(BaseModel):
    camera_id: str

class EnrollmentSample(BaseModel):
    index: int
    status: str # captured, rejected, pending
    quality_issues: List[str]

class EnrollmentCaptureResponse(BaseModel):
    sample: EnrollmentSample
    samples_count: int

# Attendance & Timeline Schemas
class AttendanceRecordResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    date: str
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    status: str # present, absent, missing
    late_minutes: int
    total_present_minutes: int

class TimelineEventResponse(BaseModel):
    id: str
    employee_id: str
    camera_id: Optional[str] = None
    camera_name: str
    timestamp: str
    event_type: str # enter, exit, seen
    confidence: float

class EventFeedbackRequest(BaseModel):
    correct: bool

# Unknown Faces
class UnknownFaceResponse(BaseModel):
    id: str
    snapshot_url: str
    detected_at: str
    camera_id: Optional[str] = None
    camera_name: str
    resolution: str # pending, linked, guest, ignored

class ResolveUnknownFaceRequest(BaseModel):
    action: str = Field(..., pattern="^(link|guest|ignore)$")
    employee_id: Optional[str] = None

# Ask Service
class AskRequest(BaseModel):
    question: str = Field(..., min_length=2)

class AskSource(BaseModel):
    type: str # camera, attendance, employee
    id: str
    name: str

class AskResponse(BaseModel):
    text: str
    sources: List[AskSource]
    confidence: Optional[float] = None # Real calculated confidence or None

# Audit Log
class AuditLogResponse(BaseModel):
    id: str
    user_email: Optional[str] = None
    action: str
    entity: str
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: str

# Internal Service Schemas (Worker -> API)
class InternalEventItem(BaseModel):
    camera_id: str
    event_type: str # enter, exit, seen
    embedding: List[float] # 128-d vector
    confidence: float
    liveness_score: float
    is_live: bool
    snapshot_base64: Optional[str] = None
    timestamp: datetime

class InternalCameraHealthReport(BaseModel):
    camera_id: str
    status: str # online, offline
    fps: int
    latency_ms: int
    last_frame_at: datetime
    error_message: Optional[str] = None

class InternalFrameAnalysisResponse(BaseModel):
    faces_detected: int
    aligned_face_found: bool
    quality_issues: List[str]
    embedding: Optional[List[float]] = None
    liveness_score: float
    is_live: bool
    snapshot_path: Optional[str] = None
