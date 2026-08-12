import type {
  AuthResponse,
  DaySummary,
  PomodoroPhase,
  PomodoroSettings,
  PomodoroStats,
  Project,
  ProjectWithStats,
  Task,
  TaskStatus,
  TaskWithStats,
  TimeEntry,
  UserSettingsResponse,
  WorkspaceInvite,
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
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => request<{ id: string; email: string; name: string }>('/auth/me'),

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
    body: Partial<{ name: string; color: string; archived: boolean }>,
  ) =>
    request<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // --- Tasks ---
  listTasks: () => request<TaskWithStats[]>('/tasks'),
  createTask: (body: {
    title: string;
    description?: string;
    estimated_minutes?: number;
    status?: TaskStatus;
    project_id?: string | null;
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
    }>,
  ) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteTask: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),

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
  entriesSummary: (from: string, to: string) =>
    request<DaySummary[]>(`/time-entries/summary?from=${from}&to=${to}`),
  listEntries: (date?: string) =>
    request<TimeEntry[]>(`/time-entries${date ? `?date=${date}` : ''}`),
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

  // --- Workspaces / команда ---
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
