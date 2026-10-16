import { fetchEventSource } from '@microsoft/fetch-event-source';
import type {
  User,
  Organization,
  Employee,
  Camera,
  AttendanceRecord,
  TimelineEvent,
  UnknownFace,
  EnrollmentSample,
  AskResponse,
  AuditLogRecord,
} from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// In-memory access token storage (Memory / Closure safe from XSS)
let inMemoryToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export function getToken(): string | null {
  return inMemoryToken;
}

export function setToken(token: string): void {
  inMemoryToken = token;
}

export function clearToken(): void {
  inMemoryToken = null;
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, message: string, code = 'unknown_error', details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Do not set Content-Type if FormData is used
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // Include HttpOnly cookies for refresh token rotation
  });

  // Handle 401 Unauthorized with silent refresh
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.access_token) {
            setToken(data.access_token);
            processQueue(null, data.access_token);
            // Retry original request
            headers['Authorization'] = `Bearer ${data.access_token}`;
            const retryRes = await fetch(`${BASE_URL}${path}`, {
              ...options,
              headers,
              credentials: 'include',
            });
            return parseResponse<T>(retryRes);
          }
        } else {
          clearToken();
          processQueue(new ApiClientError(401, 'Sessiya tugagan', 'session_expired'), null);
        }
      } catch (err) {
        clearToken();
        processQueue(err, null);
      } finally {
        isRefreshing = false;
      }
    } else {
      // Queue requests until refresh finishes
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            headers['Authorization'] = `Bearer ${newToken}`;
            fetch(`${BASE_URL}${path}`, {
              ...options,
              headers,
              credentials: 'include',
            })
              .then((r) => parseResponse<T>(r))
              .then(resolve)
              .catch(reject);
          },
          reject,
        });
      });
    }
  }

  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `So'rov bajarilmadi (${res.status})`;
    let code = 'http_error';
    let details: Record<string, unknown> = {};

    try {
      const body = await res.json();
      if (body.message) message = body.message;
      if (body.code) code = body.code;
      if (body.details) details = body.details;
    } catch {
      // Ignore parse error
    }
    throw new ApiClientError(res.status, message, code, details);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  // Handle blob responses (e.g., CSV reports or image snapshots)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('image/')) {
    return (await res.blob()) as unknown as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Authentication
  login: (email: string, password: string) =>
    request<{
      access_token?: string;
      refresh_token?: string;
      user?: User;
      requires_2fa: boolean;
      challenge_token?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verify2fa: (challengeToken: string, code: string) =>
    request<{ access_token: string; refresh_token: string; user: User }>('/auth/2fa', {
      method: 'POST',
      body: JSON.stringify({ challenge_token: challengeToken, code }),
    }),

  setup2fa: () =>
    request<{ secret: string; otpauth_url: string; backup_codes: string[] }>('/auth/2fa/setup', {
      method: 'POST',
    }),

  confirm2fa: (secret: string, code: string) =>
    request<{ message: string }>('/auth/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ secret, code }),
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request<User>('/me'),

  // Employees
  getEmployees: () => request<Employee[]>('/employees'),

  getEmployee: (id: string) => request<Employee>(`/employees/${id}`),

  createEmployee: (data: Partial<Employee>) =>
    request<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEmployee: (id: string, data: Partial<Employee>) =>
    request<Employee>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteEmployee: (id: string) =>
    request<{ status: string; message: string }>(`/employees/${id}`, {
      method: 'DELETE',
    }),

  setConsent: (
    employeeId: string,
    consentData: { granted: boolean; version?: string; method?: 'paper' | 'electronic'; document_ref?: string }
  ) =>
    request<{ status: string; consent_status: string }>(`/employees/${employeeId}/consent`, {
      method: 'POST',
      body: JSON.stringify(consentData),
    }),

  revokeConsent: (employeeId: string) =>
    request<{ status: string; message: string }>(`/employees/${employeeId}/consent`, {
      method: 'DELETE',
    }),

  captureEnrollment: (employeeId: string, cameraId: string) =>
    request<{ sample: EnrollmentSample; samples_count: number }>(
      `/employees/${employeeId}/enrollment/capture`,
      { method: 'POST', body: JSON.stringify({ camera_id: cameraId }) }
    ),

  resetEnrollment: (employeeId: string) =>
    request<{ status: string; message: string }>(`/employees/${employeeId}/enrollment`, {
      method: 'DELETE',
    }),

  // Cameras
  getCameras: () => request<Camera[]>('/cameras'),

  createCamera: (data: Partial<Camera>) =>
    request<Camera>('/cameras', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCamera: (id: string, data: Partial<Camera>) =>
    request<Camera>(`/cameras/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCamera: (id: string) =>
    request<{ status: string; message: string }>(`/cameras/${id}`, {
      method: 'DELETE',
    }),

  testCamera: (data: { name?: string; rtsp_address: string; password?: string }) =>
    request<{ success: boolean; fps: number; latency_ms: number; message: string }>('/cameras/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCameraHealth: (id: string) =>
    request<{ status: string; fps: number; latency_ms: number }>(`/cameras/${id}/health`),

  getLiveTicket: (cameraId: string) =>
    request<{ camera_id: string; ticket: string; webrtc_url: string; expires_in_seconds: number }>(
      `/cameras/${cameraId}/live-ticket`,
      { method: 'POST' }
    ),

  // Attendance & Events
  getAttendance: (date: string) => request<AttendanceRecord[]>(`/attendance?date=${date}`),

  getTimeline: (employeeId: string, date: string) =>
    request<TimelineEvent[]>(`/employees/${employeeId}/timeline?date=${date}`),

  getEventSnapshot: async (eventId: string): Promise<string> => {
    const blob = await request<Blob>(`/events/${eventId}/snapshot`);
    return URL.createObjectURL(blob);
  },

  submitFeedback: (eventId: string, correct: boolean) =>
    request<{ status: string; message: string }>(`/events/${eventId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ correct }),
    }),

  // Unknown Faces
  getUnknownFaces: (status?: string) =>
    request<UnknownFace[]>(status ? `/unknown-faces?status=${status}` : '/unknown-faces'),

  resolveUnknownFace: (id: string, action: 'link' | 'guest' | 'ignore', employeeId?: string) =>
    request<{ status: string; resolution: string }>(`/unknown-faces/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, employee_id: employeeId }),
    }),

  // Reports
  getReportJson: (from: string, to: string) =>
    request<AttendanceRecord[]>(`/reports/attendance?from=${from}&to=${to}&format=json`),

  getReportCsv: async (from: string, to: string): Promise<Blob> => {
    return request<Blob>(`/reports/attendance?from=${from}&to=${to}&format=csv`);
  },

  // Ask Service
  ask: (question: string) =>
    request<AskResponse>('/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  // Organization & Settings
  getOrganization: () => request<Organization>('/organization'),

  updateOrganization: (data: Partial<Organization>) =>
    request<Organization>('/organization', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getUsers: () => request<User[]>('/users'),

  createUser: (data: { email: string; password: string; name: string; role: string }) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: { name?: string; role?: string; is_active?: boolean }) =>
    request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAuditLogs: () => request<AuditLogRecord[]>('/audit-logs'),

  // Server-Sent Events with Authorization header
  connectSSE: (handlers: {
    onOpen?: () => void;
    onMessage: (event: string, data: unknown) => void;
    onError?: (err: unknown) => void;
    onClose?: () => void;
  }) => {
    const token = getToken();
    const ctrl = new AbortController();

    fetchEventSource(`${BASE_URL}/stream/events${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
      signal: ctrl.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      async onopen(response) {
        if (response.ok) {
          handlers.onOpen?.();
        } else {
          handlers.onError?.(new Error(`SSE connection failed with status ${response.status}`));
        }
      },
      onmessage(msg) {
        try {
          const parsed = msg.data ? JSON.parse(msg.data) : null;
          handlers.onMessage(msg.event || 'message', parsed);
        } catch {
          handlers.onMessage(msg.event || 'message', msg.data);
        }
      },
      onerror(err) {
        handlers.onError?.(err);
      },
      onclose() {
        handlers.onClose?.();
      },
    });

    return () => ctrl.abort();
  },
};
