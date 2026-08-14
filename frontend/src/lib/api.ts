import type {
  Absence,
  AbsenceKind,
  AppNotification,
  AuditRow,
  AuthResponse,
  AuthUser,
  ClientDashboard,
  Currency,
  DaySummary,
  Department,
  MemberSummary,
  Milestone,
  MilestoneStatus,
  PayKind,
  ReportCommentView,
  SessionView,
  Workspace,
  WorkspaceListItem,
  GenerateReportBody,
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
  login: (body: {
    email: string;
    password: string;
    totp_code?: string;
    captcha_answer?: string;
  }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => request<AuthUser>('/auth/me'),

  // --- SSO: Google / Яндекс ---
  oauthProviders: () =>
    request<{ google: boolean; yandex: boolean }>('/auth/oauth/providers'),
  /** URL старта SSO-входа: браузер уходит на провайдера и вернётся с токеном. */
  oauthStartUrl: (provider: 'google' | 'yandex') =>
    `${API_URL}/auth/oauth/${provider}`,

  // --- Auth 2.0: капча, magic link, сброс пароля, сессии ---
  captchaRequired: (email: string) =>
    request<{ required: boolean }>(
      `/auth/captcha-required?email=${encodeURIComponent(email)}`,
    ),
  sendMagicLink: (email: string) =>
    request<{ sent: boolean }>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  magicLogin: (token: string) =>
    request<AuthResponse>('/auth/magic-login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  forgotPassword: (email: string) =>
    request<{ sent: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<AuthResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
  listSessions: () => request<SessionView[]>('/auth/sessions'),
  revokeSession: (id: string) =>
    request<void>(`/auth/sessions/${id}`, { method: 'DELETE' }),
  revokeAllSessions: () =>
    request<void>('/auth/sessions/revoke-all', { method: 'POST' }),

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
  updateAvatar: (avatarUrl: string | null) =>
    request<AuthUser>('/users/me/avatar', {
      method: 'PATCH',
      body: JSON.stringify({ avatar_url: avatarUrl }),
    }),
  exportMyData: () => request<Record<string, unknown>>('/users/me/export'),
  deleteAccount: (email: string) =>
    request<void>('/users/me/delete', {
      method: 'POST',
      body: JSON.stringify({ email }),
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

  // --- Вехи проекта ---
  listMilestones: (projectId: string) =>
    request<Milestone[]>(`/projects/${projectId}/milestones`),
  createMilestone: (
    projectId: string,
    body: { title: string; due_date?: string | null },
  ) =>
    request<Milestone>(`/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMilestone: (
    id: string,
    body: Partial<{
      title: string;
      due_date: string | null;
      status: MilestoneStatus;
    }>,
  ) =>
    request<Milestone>(`/projects/milestones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteMilestone: (id: string) =>
    request<void>(`/projects/milestones/${id}`, { method: 'DELETE' }),

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
    external_url?: string | null;
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
      external_url: string | null;
    }>,
  ) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteTask: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  bulkTasks: (ids: string[], action: 'todo' | 'in_progress' | 'done' | 'delete') =>
    request<{ updated: number }>('/tasks/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, action }),
    }),

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

  // --- Генератор текстов (стендап и другие отчёты) ---
  generateReport: (body: GenerateReportBody) =>
    request<{ text: string }>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  sendReport: (channel: 'slack' | 'tg', text: string) =>
    request<{ sent: boolean }>('/reports/send', {
      method: 'POST',
      body: JSON.stringify({ channel, text }),
    }),

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
  clientDashboard: () => request<ClientDashboard>('/reports/client-dashboard'),
  listReportComments: (projectId?: string | null) =>
    request<ReportCommentView[]>(
      `/report-comments${projectId ? `?project_id=${projectId}` : ''}`,
    ),
  addReportComment: (body: string, projectId?: string | null) =>
    request<ReportCommentView>('/report-comments', {
      method: 'POST',
      body: JSON.stringify({ body, project_id: projectId ?? undefined }),
    }),

  // --- Notifications / audit ---
  listNotifications: (opts: {
    limit?: number;
    filter?: 'all' | 'unread' | 'timesheets' | 'tasks';
    before?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.filter && opts.filter !== 'all') params.set('filter', opts.filter);
    if (opts.before) params.set('before', opts.before);
    const qs = params.toString();
    return request<{ items: AppNotification[]; unread: number }>(
      `/notifications${qs ? `?${qs}` : ''}`,
    );
  },
  readAllNotifications: () =>
    request<void>('/notifications/read-all', { method: 'POST' }),
  readNotification: (id: string) =>
    request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  deleteNotification: (id: string) =>
    request<void>(`/notifications/${id}`, { method: 'DELETE' }),
  clearNotifications: () =>
    request<void>('/notifications', { method: 'DELETE' }),

  // --- Web Push ---
  getVapidKey: () =>
    request<{ public_key: string; enabled: boolean }>('/notifications/push/key'),
  subscribePush: (body: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }) =>
    request<void>('/notifications/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  unsubscribePush: (endpoint: string) =>
    request<void>('/notifications/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }),
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
  listWorkspaces: () => request<WorkspaceListItem[]>('/workspaces'),
  createWorkspace: (body: {
    name: string;
    departments?: string[];
    invites?: string[];
  }) =>
    request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  switchWorkspace: (workspaceId: string) =>
    request<Workspace>('/workspaces/switch', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId }),
    }),
  updateWorkspace: (
    body: Partial<{
      name: string;
      currency: Currency;
      brand_color: string;
      logo_url: string | null;
      day_norm_hours: number;
      rounding_minutes: number;
    }>,
  ) =>
    request<Workspace>('/workspaces/current', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // --- Отделы ---
  listDepartments: () =>
    request<Department[]>('/workspaces/current/departments'),
  createDepartment: (name: string) =>
    request<Department>('/workspaces/current/departments', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteDepartment: (id: string) =>
    request<void>(`/workspaces/current/departments/${id}`, {
      method: 'DELETE',
    }),

  // --- Профиль сотрудника, оплата, отсутствия ---
  memberSummary: (userId: string) =>
    request<MemberSummary>(`/members/${userId}/summary`),
  updateMember: (
    userId: string,
    body: Partial<{
      department_id: string | null;
      pay_kind: PayKind;
      pay_rate: number;
    }>,
  ) =>
    request<unknown>(`/workspaces/current/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  listAbsences: (userId?: string) =>
    request<Absence[]>(`/absences${userId ? `?user_id=${userId}` : ''}`),
  createAbsence: (body: {
    user_id: string;
    date_from: string;
    date_to: string;
    kind?: AbsenceKind;
  }) =>
    request<Absence>('/absences', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteAbsence: (id: string) =>
    request<void>(`/absences/${id}`, { method: 'DELETE' }),
  bulkInvite: (emails: string[], role?: WorkspaceRole) =>
    request<{ invited: number }>('/workspaces/current/invites/bulk', {
      method: 'POST',
      body: JSON.stringify({ emails, role }),
    }),
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
