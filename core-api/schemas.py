from typing import Optional, List, Any
from datetime import datetime, date, time
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Verify2FARequest(BaseModel):
    code: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization_id: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse
    requires_2fa: bool

# Employee schemas
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    position: str
    department: str
    phone: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class EmployeeResponse(EmployeeBase):
    id: str
    consent_status: str
    consent_date: Optional[datetime] = None
    enrollment_status: str
    enrollment_samples: int
    is_active: bool
    created_at: datetime

class ConsentRequest(BaseModel):
    granted: bool

# Camera schemas
class CameraBase(BaseModel):
    name: str
    type: str = "general" # entrance, exit, general
    rtsp_address: str

class CameraCreate(CameraBase):
    password: Optional[str] = None

class CameraTestRequest(BaseModel):
    name: str
    rtsp_address: str
    password: Optional[str] = None

class CameraTestResponse(BaseModel):
    success: bool
    fps: int
    latency_ms: int
    message: str

class CameraResponse(BaseModel):
    id: str
    name: str
    type: str
    status: str
    fps: int
    latency_ms: int
    last_frame_at: Optional[datetime] = None
    rtsp_address: str
    organization_id: Optional[str] = None

class CameraHealthResponse(BaseModel):
    status: str
    fps: int
    latency_ms: int

# Enrollment schemas
class EnrollmentCaptureRequest(BaseModel):
    camera_id: str

class EnrollmentSample(BaseModel):
    index: int
    status: str # captured, rejected, pending
    quality_issues: List[str] = []

class EnrollmentCaptureResponse(BaseModel):
    sample: EnrollmentSample
    samples_count: int

# Attendance schemas
class AttendanceRecordResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    date: date
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    status: str # present, absent, missing
    late_minutes: int
    total_present_minutes: int

class TimelineEventResponse(BaseModel):
    id: str
    employee_id: str
    camera_id: Optional[str] = None
    camera_name: Optional[str] = None
    timestamp: datetime
    event_type: str # enter, exit, seen
    confidence: float

# Unknown Faces
class UnknownFaceResponse(BaseModel):
    id: str
    snapshot_url: str
    detected_at: datetime
    camera_id: Optional[str] = None
    camera_name: Optional[str] = None
    resolution: str

class ResolveUnknownFaceRequest(BaseModel):
    action: str # link, guest, ignore
    employee_id: Optional[str] = None

# Feedback
class EventFeedbackRequest(BaseModel):
    correct: bool

# Natural language query
class AskSource(BaseModel):
    type: str # camera, attendance, employee
    id: str
    name: str

class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    text: str
    sources: List[AskSource] = []
    confidence: float
