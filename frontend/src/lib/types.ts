export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskPriority = 'high' | 'med' | 'low';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  email_verified_at?: string | null;
  totp_enabled?: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  hourly_rate: number;
  weekly_budget_hours: number;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface ProjectWithStats extends Project {
  task_count: number;
  week_tracked_seconds: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  estimated_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  project_id: string | null;
  project?: Project | null;
  assignee_id: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  priority: TaskPriority;
  due_date: string | null;
  external_url: string | null;
}

export interface TaskWithStats extends Task {
  total_tracked_seconds: number;
  pomodoro_count: number;
}

export interface TimeEntry {
  id: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  is_manual: boolean;
  billable: boolean;
  note: string | null;
  created_at: string;
  task_id: string | null;
  task?: Task | null;
}

export interface DaySummary {
  date: string;
  total_seconds: number;
  by_project: {
    project_id: string | null;
    seconds: number;
    billable_seconds: number;
  }[];
  by_task: {
    task_id: string;
    task_title: string;
    project_id: string | null;
    seconds: number;
    billable_seconds: number;
  }[];
}

export interface PomodoroSettings {
  id: string;
  work_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  long_break_interval: number;
  auto_start: boolean;
  track_to_timer: boolean;
  updated_at: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'pm' | 'member' | 'client';

export interface WorkspaceMe {
  workspace_id: string;
  workspace_name: string;
  role: WorkspaceRole;
  project_id: string | null;
}

export interface WorkspaceMemberView {
  user_id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  active_task_title: string | null;
  dnd: boolean;
  today_seconds: number;
  week_seconds: number;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: 'pending' | 'revoked' | 'accepted';
  created_at: string;
}

export interface AppNotification {
  id: string;
  text: string;
  dot: 'accent' | 'green' | 'red' | 'amber';
  read: boolean;
  created_at: string;
}

export interface AuditRow {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  project_id: string | null;
  project?: Project | null;
  estimated_minutes: number | null;
}

export interface InvoicePreview {
  number: string;
  period: { from: string; to: string };
  project_name: string;
  rows: { task_title: string; hours: number; rate: number; sum: number }[];
  total: number;
}

export interface ReportShare {
  id: string;
  project_id: string | null;
  token: string;
  hide_money: boolean;
  hide_names: boolean;
  active: boolean;
}

export interface PublicReport {
  project_name: string;
  project_color: string | null;
  period: { from: string; to: string };
  days: { date: string; seconds: number }[];
  tasks: { title: string; seconds: number }[];
  members: { name: string; seconds: number }[];
  total_seconds: number;
  money: number | null;
}

export type TimesheetStatus = 'draft' | 'pending' | 'approved' | 'returned';

export interface TimesheetView {
  id: string | null;
  user_id: string;
  user_name: string;
  week_start: string;
  status: TimesheetStatus;
  comment: string | null;
  summary: string | null;
  total_seconds: number;
}

export interface TimesheetsResponse {
  week_start: string;
  mine: TimesheetView;
  team: TimesheetView[];
}

export interface UserSettingsResponse {
  id: string;
  daily_goal_hours: number;
  idle_threshold_minutes: number;
  notify_day_start: boolean;
  notify_goal_reached: boolean;
  theme: 'dark' | 'light';
  dnd_until: string | null;
  auto_stop_evening: boolean;
  standup_greeting: string;
  standup_misc_line: string;
  standup_signature: string;
  standup_auto_send: boolean;
  monthly_hours_limit: number;
  updated_at: string;
  user_id: string;
}

export type GeneratorMode = 'standup' | 'client' | 'team' | 'notes';

export interface GenerateReportBody {
  mode: GeneratorMode;
  direction?: 'ys' | 'st';
  include_misc?: boolean;
  ai_summary?: boolean;
  hours_limit?: number;
  project_id?: string | null;
}

export interface PomodoroStats {
  date: string;
  completed_work_sessions: number;
  total_focus_seconds: number;
  total_break_seconds: number;
}
