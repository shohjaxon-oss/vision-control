const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const IS_MOCK = import.meta.env.VITE_API_MODE === 'mock';

function getToken(): string | null {
  return localStorage.getItem('wfv_token');
}

export function setToken(token: string): void {
  localStorage.setItem('wfv_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('wfv_token');
}

export function isMockMode(): boolean {
  return IS_MOCK;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `So'rov bajarilmadi (${res.status})`;
    try {
      const body = await res.json();
      if (body.message) message = body.message;
    } catch {
      // ignore parse error
    }
    throw new ApiClientError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user: import('@/types').User; requires_2fa: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verify2fa: (code: string) =>
    request<{ access_token: string; refresh_token: string; user: import('@/types').User }>('/auth/2fa', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getEmployees: () =>
    request<import('@/types').Employee[]>('/employees'),

  getEmployee: (id: string) =>
    request<import('@/types').Employee>(`/employees/${id}`),

  createEmployee: (data: Partial<import('@/types').Employee>) =>
    request<import('@/types').Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEmployee: (id: string, data: Partial<import('@/types').Employee>) =>
    request<import('@/types').Employee>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  setConsent: (employeeId: string, granted: boolean) =>
    request(`/employees/${employeeId}/consent`, {
      method: 'POST',
      body: JSON.stringify({ granted }),
    }),

  revokeConsent: (employeeId: string) =>
    request(`/employees/${employeeId}/consent`, {
      method: 'DELETE',
    }),

  captureEnrollment: (employeeId: string, cameraId: string) =>
    request<{ sample: import('@/types').EnrollmentSample; samples_count: number }>(
      `/employees/${employeeId}/enrollment/capture`,
      { method: 'POST', body: JSON.stringify({ camera_id: cameraId }) }
    ),

  getCameras: () =>
    request<import('@/types').Camera[]>('/cameras'),

  testCamera: (data: { name: string; rtsp_address: string; password: string }) =>
    request<{ success: boolean; fps: number; latency_ms: number; message: string }>('/cameras/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createCamera: (data: Partial<import('@/types').Camera>) =>
    request<import('@/types').Camera>('/cameras', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCameraHealth: (id: string) =>
    request<{ status: string; fps: number; latency_ms: number }>(`/cameras/${id}/health`),

  getAttendance: (date: string) =>
    request<import('@/types').AttendanceRecord[]>(`/attendance?date=${date}`),

  getTimeline: (employeeId: string, date: string) =>
    request<import('@/types').TimelineEvent[]>(`/employees/${employeeId}/timeline?date=${date}`),

  getUnknownFaces: () =>
    request<import('@/types').UnknownFace[]>('/unknown-faces'),

  resolveUnknownFace: (id: string, action: 'link' | 'guest' | 'ignore', employeeId?: string) =>
    request(`/unknown-faces/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, employee_id: employeeId }),
    }),

  submitFeedback: (eventId: string, correct: boolean) =>
    request(`/events/${eventId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ correct }),
    }),

  getReport: (from: string, to: string, format: 'json' | 'csv' = 'json') =>
    request(`/reports/attendance?from=${from}&to=${to}&format=${format}`),

  ask: (question: string) =>
    request<import('@/types').AskResponse>('/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  getOrganization: () =>
    request<import('@/types').Organization>('/organization'),

  updateOrganization: (data: Partial<import('@/types').Organization>) =>
    request<import('@/types').Organization>('/organization', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAuditLogs: () =>
    request<import('@/types').AuditLogRecord[]>('/audit-logs'),

  streamEvents: () => {
    const token = getToken();
    return new EventSource(`${BASE_URL}/stream/events?token=${token}`);
  },
};
