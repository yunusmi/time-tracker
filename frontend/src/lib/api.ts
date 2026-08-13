import type {
  AppNotification,
  AuditRow,
  AuthResponse,
  AuthUser,
  DaySummary,
  InvoicePreview,
  PomodoroPhase,
  PomodoroSettings,
  PomodoroStats,
  Project,
  ProjectWithStats,
  PublicReport,
  ReportShare,
  Task,
  TaskPriority,
  TaskStatus,
  TaskTemplate,
  TaskWithStats,
  TimeEntry,
  TimesheetsResponse,
  UserSettingsResponse,
  WorkspaceInvite,
  WorkspaceMe,
  WorkspaceMemberView,
  WorkspaceRole,
} from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const TOKEN_KEY = 'tt_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && (data.message as string | string[])) || res.statusText;
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : message,
    );
  }
  return data as T;
}

export const api = {
  // --- Auth ---
  register: (body: { email: string; name: string; password: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string; totp_code?: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => request<AuthUser>('/auth/me'),

  // --- Account / verification ---
  updateMe: (body: Partial<{ name: string; email: string }>) =>
    request<AuthUser>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<void>('/users/me/password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  sendVerifyEmail: () =>
    request<{ sent: boolean }>('/auth/verify/send', { method: 'POST' }),
  setup2fa: () =>
    request<{ secret: string; otpauth_url: string }>('/auth/2fa/setup', {
      method: 'POST',
    }),
  enable2fa: (code: string) =>
    request<void>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  disable2fa: () => request<void>('/auth/2fa/disable', { method: 'POST' }),
  verifyEmail: (token: string) =>
    request<{ verified: boolean; email: string }>(
      `/auth/verify?token=${encodeURIComponent(token)}`,
    ),

  // --- User settings ---
  getUserSettings: () => request<UserSettingsResponse>('/users/me/settings'),
  updateUserSettings: (body: Partial<Omit<UserSettingsResponse, 'id' | 'updated_at' | 'user_id'>>) =>
    request<UserSettingsResponse>('/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // --- Projects ---
  listProjects: (includeArchived = false) =>
    request<ProjectWithStats[]>(
      `/projects${includeArchived ? '?include_archived=true' : ''}`,
    ),
  createProject: (body: { name: string; color?: string }) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateProject: (
    id: string,
    body: Partial<{
      name: string;
      color: string;
      archived: boolean;
      hourly_rate: number;
      weekly_budget_hours: number;
    }>,
  ) =>
    request<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // --- Tasks ---
  listTasks: (who?: 'all' | 'mine') =>
    request<TaskWithStats[]>(`/tasks${who ? `?who=${who}` : ''}`),
  createTask: (body: {
    title: string;
    description?: string;
    estimated_minutes?: number;
    status?: TaskStatus;
    project_id?: string | null;
    assignee_id?: string | null;
    priority?: TaskPriority;
    due_date?: string | null;
  }) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (
    id: string,
    body: Partial<{
      title: string;
      description: string;
      estimated_minutes: number;
      status: TaskStatus;
      project_id: string | null;
      assignee_id: string | null;
      priority: TaskPriority;
      due_date: string | null;
    }>,
  ) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteTask: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  // --- Task templates ---
  listTaskTemplates: () => request<TaskTemplate[]>('/task-templates'),
  createTaskTemplate: (body: {
    title: string;
    project_id?: string | null;
    estimated_minutes?: number | null;
  }) =>
    request<TaskTemplate>('/task-templates', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteTaskTemplate: (id: string) =>
    request<void>(`/task-templates/${id}`, { method: 'DELETE' }),

  // --- Time entries ---
  activeEntry: () => request<TimeEntry | null>('/time-entries/active'),
  startTimer: (body: { task_id?: string; description?: string }) =>
    request<TimeEntry>('/time-entries/start', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  stopTimer: (body?: { ended_at?: string }) =>
    request<TimeEntry>('/time-entries/stop', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  entriesSummary: (from: string, to: string, userId?: string) =>
    request<DaySummary[]>(
      `/time-entries/summary?from=${from}&to=${to}${userId ? `&user_id=${userId}` : ''}`,
    ),
  listEntries: (date?: string, userId?: string) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (userId) params.set('user_id', userId);
    const qs = params.toString();
    return request<TimeEntry[]>(`/time-entries${qs ? `?${qs}` : ''}`);
  },
  // Manual entry is defined by a start (from) and end (to) timestamp.
  createManualEntry: (body: {
    task_id?: string;
    description?: string;
    started_at: string;
    ended_at: string;
  }) =>
    request<TimeEntry>('/time-entries', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEntry: (
    id: string,
    body: Partial<{
      description: string;
      task_id: string | null;
      started_at: string;
      ended_at: string;
      billable: boolean;
      note: string;
    }>,
  ) =>
    request<TimeEntry>(`/time-entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteEntry: (id: string) =>
    request<void>(`/time-entries/${id}`, { method: 'DELETE' }),

  // --- Pomodoro ---
  getPomodoroSettings: () =>
    request<PomodoroSettings>('/pomodoro/settings'),
  updatePomodoroSettings: (body: Partial<PomodoroSettings>) =>
    request<PomodoroSettings>('/pomodoro/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createPomodoroSession: (body: {
    phase: PomodoroPhase;
    duration_seconds: number;
    completed?: boolean;
    started_at: string;
    ended_at: string;
    task_id?: string;
  }) =>
    request<unknown>('/pomodoro/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getPomodoroStats: (date?: string) =>
    request<PomodoroStats>(`/pomodoro/stats${date ? `?date=${date}` : ''}`),

  // --- Invoices / public reports ---
  invoicePreview: (from: string, to: string, projectId?: string) =>
    request<InvoicePreview>(
      `/invoices/preview?from=${from}&to=${to}${projectId ? `&project_id=${projectId}` : ''}`,
    ),
  getOrCreateReportShare: (projectId?: string | null) =>
    request<ReportShare>('/report-shares', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId ?? undefined }),
    }),
  updateReportShare: (
    id: string,
    body: Partial<{ active: boolean; hide_money: boolean; hide_names: boolean }>,
  ) =>
    request<ReportShare>(`/report-shares/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  publicReport: (token: string) =>
    request<PublicReport>(`/public/reports/${token}`),
  myProjectReport: () => request<PublicReport>('/reports/my-project'),

  // --- Notifications / audit ---
  listNotifications: () =>
    request<{ items: AppNotification[]; unread: number }>('/notifications'),
  readAllNotifications: () =>
    request<void>('/notifications/read-all', { method: 'POST' }),
  clearNotifications: () =>
    request<void>('/notifications', { method: 'DELETE' }),
  listAudit: (limit = 20) => request<AuditRow[]>(`/audit?limit=${limit}`),

  // --- Timesheets ---
  listTimesheets: (week?: string) =>
    request<TimesheetsResponse>(`/timesheets${week ? `?week=${week}` : ''}`),
  submitTimesheet: (week?: string) =>
    request<unknown>('/timesheets/submit', {
      method: 'POST',
      body: JSON.stringify(week ? { week } : {}),
    }),
  reviewTimesheet: (id: string, action: 'approve' | 'return', comment?: string) =>
    request<unknown>(`/timesheets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, comment }),
    }),
  approveAllTimesheets: (week?: string) =>
    request<{ approved: number }>('/timesheets/approve-all', {
      method: 'POST',
      body: JSON.stringify(week ? { week } : {}),
    }),

  // --- Workspaces / команда ---
  getWorkspaceMe: () => request<WorkspaceMe>('/workspaces/current/me'),
  changeMemberRole: (
    userId: string,
    body: { role: WorkspaceRole; project_id?: string | null },
  ) =>
    request<unknown>(`/workspaces/current/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getWorkspaceMembers: () =>
    request<WorkspaceMemberView[]>('/workspaces/current/members'),
  listWorkspaceInvites: () =>
    request<WorkspaceInvite[]>('/workspaces/current/invites'),
  sendWorkspaceInvite: (body: { email: string; role?: WorkspaceRole }) =>
    request<WorkspaceInvite>('/workspaces/current/invites', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revokeWorkspaceInvite: (id: string) =>
    request<void>(`/workspaces/current/invites/${id}`, { method: 'DELETE' }),
  getInviteLink: () =>
    request<{ token: string }>('/workspaces/current/invite-link'),
  acceptInvite: (token: string) =>
    request<unknown>(`/invites/${token}/accept`, { method: 'POST' }),

  // --- Export (binary) ---
  exportReport: async (
    from: string,
    to: string,
    projectId?: string,
  ): Promise<void> => {
    const token = getToken();
    const res = await fetch(
      `${API_URL}/export/report?from=${from}&to=${to}${projectId ? `&project_id=${projectId}` : ''}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-report-${from}_${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  exportToday: async (date?: string): Promise<void> => {
    const token = getToken();
    const res = await fetch(
      `${API_URL}/export/today${date ? `?date=${date}` : ''}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'time-report.xlsx';
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
