export type Role = 'owner' | 'manager' | 'observer';

export type ConsentStatus = 'granted' | 'denied' | 'revoked' | 'pending';

export type EnrollmentStatus = 'enrolled' | 'partial' | 'none';

export type CameraType = 'entrance' | 'exit' | 'general';

export type CameraStatus = 'online' | 'offline';

export type UnknownFaceResolution = 'linked' | 'guest' | 'ignored' | 'pending';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  organization_id: string;
}

export interface Organization {
  id: string;
  name: string;
  timezone?: string;
  shift_start: string;
  shift_end: string;
  retention_days: number;
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  phone: string | null;
  consent_status: ConsentStatus;
  consent_date: string | null;
  enrollment_status: EnrollmentStatus;
  enrollment_samples: number;
  created_at: string;
  is_active: boolean;
}

export interface CameraPosition {
  x: number;
  y: number;
  z: number;
  yaw: number;
  fov: number;
  floor?: number;
}

export interface Camera {
  id: string;
  name: string;
  type: CameraType;
  status: CameraStatus;
  fps: number;
  latency_ms: number;
  last_frame_at: string | null;
  rtsp_address: string;
  rtsp_masked?: string;
  position?: CameraPosition;
  organization_id: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  first_seen: string | null;
  last_seen: string | null;
  status: 'present' | 'absent' | 'missing';
  late_minutes: number;
  total_present_minutes: number;
}

export interface TimelineEvent {
  id: string;
  employee_id: string;
  camera_id: string | null;
  camera_name: string;
  timestamp: string;
  event_type: 'enter' | 'exit' | 'seen';
  confidence: number;
}

export interface UnknownFace {
  id: string;
  snapshot_url: string;
  detected_at: string;
  camera_id: string | null;
  camera_name: string;
  resolution: UnknownFaceResolution;
}

export interface EnrollmentSample {
  index: number;
  status: 'captured' | 'rejected' | 'pending';
  quality_issues: string[];
}

export interface AskSource {
  type: 'camera' | 'attendance' | 'employee';
  id: string;
  name: string;
}

export interface AskResponse {
  text: string;
  sources: AskSource[];
  confidence: number | null;
}

export interface LoginResponse {
  requires_2fa: boolean;
  challenge_token?: string;
  access_token?: string;
  refresh_token?: string;
  user?: User;
}

export interface AuditLogRecord {
  id: string;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | string | null;
  ip_address: string | null;
  created_at: string;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
