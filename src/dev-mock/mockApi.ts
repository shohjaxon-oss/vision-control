import type {
  Employee,
  Camera,
  AttendanceRecord,
  TimelineEvent,
  UnknownFace,
  User,
  EnrollmentSample,
  AskResponse,
} from '@/types';
import {
  mockUser,
  mockEmployees,
  mockCameras,
  mockAttendance,
  mockTimelineEvents,
  mockUnknownFaces,
  mockOrganization,
  mockAuditLogs,
} from './data';

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let employees = [...mockEmployees];
let unknownFaces = [...mockUnknownFaces];

export const mockApi = {
  login: (_email: string, _password: string) =>
    delay({
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      user: mockUser,
      requires_2fa: true,
    }),

  verify2fa: (code: string) => {
    if (code === '123456') {
      return delay({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        user: mockUser,
      });
    }
    return Promise.reject({ status: 401, message: 'Tasdiqlash kodi noto\'g\'ri' });
  },

  getEmployees: () => delay([...employees]),

  getEmployee: (id: string) =>
    delay(employees.find((e) => e.id === id) || employees[0]),

  createEmployee: (data: Partial<Employee>) => {
    const newEmp: Employee = {
      id: `emp-${String(employees.length + 1).padStart(3, '0')}`,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      position: data.position || '',
      department: data.department || '',
      phone: data.phone || '',
      consent_status: data.consent_status || 'pending',
      consent_date: data.consent_date || null,
      enrollment_status: data.enrollment_status || 'none',
      enrollment_samples: data.enrollment_samples || 0,
      created_at: new Date().toISOString(),
      is_active: true,
    };
    employees = [newEmp, ...employees];
    return delay(newEmp);
  },

  updateEmployee: (id: string, data: Partial<Employee>) => {
    employees = employees.map((e) => (e.id === id ? { ...e, ...data } : e));
    return delay(employees.find((e) => e.id === id)!);
  },

  setConsent: (employeeId: string, granted: boolean) => {
    employees = employees.map((e) =>
      e.id === employeeId
        ? {
            ...e,
            consent_status: granted ? 'granted' : 'denied',
            consent_date: granted ? new Date().toISOString() : null,
          }
        : e
    );
    return delay({});
  },

  revokeConsent: (employeeId: string) => {
    employees = employees.map((e) =>
      e.id === employeeId
        ? {
            ...e,
            consent_status: 'revoked',
            consent_date: null,
            enrollment_status: 'none',
            enrollment_samples: 0,
          }
        : e
    );
    return delay({});
  },

  captureEnrollment: (_employeeId: string, _cameraId: string) => {
    const issues: string[] = [];
    const rand = Math.random();
    if (rand < 0.2) issues.push('Rasm xira');
    else if (rand < 0.4) issues.push('Rasm qorong\'i');
    else if (rand < 0.55) issues.push('Yuz qiyshiq');

    const sample: EnrollmentSample = {
      index: 0,
      status: issues.length > 0 ? 'rejected' : 'captured',
      quality_issues: issues,
    };
    return delay({ sample, samples_count: 1 });
  },

  getCameras: () => delay([...mockCameras]),

  testCamera: (_data: { name: string; rtsp_address: string; password: string }) =>
    delay({ success: true, fps: 30, latency_ms: 45, message: 'Ulanish muvaffaqiyatli' }, 1000),

  createCamera: (data: Partial<Camera>) => {
    const newCam: Camera = {
      id: `cam-${String(mockCameras.length + 1).padStart(3, '0')}`,
      name: data.name || '',
      type: data.type || 'general',
      status: 'online',
      fps: 30,
      latency_ms: 50,
      last_frame_at: new Date().toISOString(),
      rtsp_address: data.rtsp_address || '',
      organization_id: 'org-001',
    };
    mockCameras.push(newCam);
    return delay(newCam);
  },

  getCameraHealth: (id: string) => {
    const cam = mockCameras.find((c) => c.id === id);
    return delay({
      status: cam?.status || 'offline',
      fps: cam?.fps || 0,
      latency_ms: cam?.latency_ms || 0,
    });
  },

  getAttendance: (_date: string) => delay([...mockAttendance]),

  getTimeline: (_employeeId: string, _date: string) => delay([...mockTimelineEvents]),

  getUnknownFaces: () => delay([...unknownFaces]),

  resolveUnknownFace: (id: string, action: 'link' | 'guest' | 'ignore', _employeeId?: string) => {
    unknownFaces = unknownFaces.map((f) =>
      f.id === id
        ? {
            ...f,
            resolution: action === 'link' ? 'linked' : action === 'guest' ? 'guest' : 'ignored',
          }
        : f
    );
    return delay({});
  },

  submitFeedback: (_eventId: string, _correct: boolean) => delay({}),

  getReport: (_from: string, _to: string, _format: 'json' | 'csv') =>
    delay([...mockAttendance]),

  ask: (question: string): Promise<AskResponse> => {
    const responses: Record<string, AskResponse> = {
      default: {
        text: 'Hozircha bu savol bo\'yicha ma\'lumot yo\'q. Boshqacha shakllashtirib ko\'ring.',
        sources: [],
        confidence: 0.3,
      },
      kim: {
        text: 'Hozir ofisda 4 xodim bor: Bekzod Karimov, Aziza Yusupova, Jasur Tolipov, Nilufar Sattorova. Jasur Tolipov so\'nggi marta 10:45 da ko\'rilgan.',
        sources: [
          { type: 'attendance', id: 'att-003', name: 'Jasur Tolipov' },
          { type: 'camera', id: 'cam-001', name: 'Bosh kirish' },
        ],
        confidence: 0.92,
      },
    };
    const key = question.toLowerCase().includes('kim') ? 'kim' : 'default';
    return delay(responses[key], 500);
  },

  getOrganization: () => delay({ ...mockOrganization }),

  updateOrganization: (data: Partial<import('@/types').Organization>) => {
    Object.assign(mockOrganization, data);
    return delay({ ...mockOrganization });
  },

  getAuditLogs: () => delay([...mockAuditLogs]),
};
