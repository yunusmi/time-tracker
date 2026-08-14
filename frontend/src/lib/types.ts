export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskPriority = 'high' | 'med' | 'low';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  email_verified_at?: string | null;
  totp_enabled?: boolean;
  avatar_url?: string | null;
}

export interface SessionView {
  id: string;
  device: string;
  ip: string | null;
  last_seen: string;
  created_at: string;
  current: boolean;
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

export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'UZS';

export type PayKind = 'hourly' | 'salary';

export type AbsenceKind = 'vacation' | 'sick';

export interface Workspace {
  id: string;
  name: string;
  currency: Currency;
  brand_color: string;
  logo_url: string | null;
  day_norm_hours: number;
  rounding_minutes: number;
  owner_id: string;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  brand_color: string;
  logo_url: string | null;
  role: WorkspaceRole;
  active: boolean;
}

export interface WorkspaceMe {
  workspace_id: string;
  workspace_name: string;
  role: WorkspaceRole;
  project_id: string | null;
  currency: Currency;
  brand_color: string;
  logo_url: string | null;
  day_norm_hours: number;
  rounding_minutes: number;
}

export interface WorkspaceMemberView {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: WorkspaceRole;
  department_id: string | null;
  department_name: string | null;
  active_task_title: string | null;
  dnd: boolean;
  absence_kind: AbsenceKind | null;
  absence_until: string | null;
  pay_kind: PayKind | null;
  pay_rate: number | null;
  hourly_rate: number | null;
  today_seconds: number;
  week_seconds: number;
}

export interface Department {
  id: string;
  workspace_id: string;
  name: string;
}

export interface Absence {
  id: string;
  user_id: string;
  date_from: string;
  date_to: string;
  kind: AbsenceKind;
}

export interface MemberSummary {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: WorkspaceRole;
  department_id: string | null;
  department_name: string | null;
  pay_kind: PayKind;
  pay_rate: number;
  hourly_rate: number;
  today_seconds: number;
  week_seconds: number;
  open_tasks: {
    id: string;
    title: string;
    due_date: string | null;
    priority: TaskPriority;
  }[];
  absence: { kind: AbsenceKind; date_from: string; date_to: string } | null;
  absences: Absence[];
}

export type MilestoneStatus = 'plan' | 'in_progress' | 'done';

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  status: MilestoneStatus;
}

export interface ClientDashboard {
  project_id: string;
  project_name: string;
  project_color: string;
  budget: {
    budget_hours: number;
    used_hours: number;
    week_hours: number;
    forecast_date: string | null;
  };
  milestones: Milestone[];
  feed: { id: string; action: string; created_at: string }[];
}

export interface ReportCommentView {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
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

export type NotificationKind =
  | 'task'
  | 'timesheet'
  | 'standup'
  | 'digest'
  | 'system';

export interface AppNotification {
  id: string;
  text: string;
  dot: 'accent' | 'green' | 'red' | 'amber';
  kind: NotificationKind;
  action_screen: string | null;
  channels: string[];
  read: boolean;
  created_at: string;
}

/** События матрицы «Настройки → Уведомления». */
export type NotificationEvent =
  | 'task_assigned'
  | 'admin_edits'
  | 'timesheet_status'
  | 'standup_reminder'
  | 'weekly_digest';

export type NotificationChannel = 'email' | 'push' | 'app';

export type NotificationPrefs = Partial<
  Record<NotificationEvent, Partial<Record<NotificationChannel, boolean>>>
>;

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
  currency: Currency;
  workspace_name: string;
  brand_color: string;
  logo_url: string | null;
  period: { from: string; to: string };
  days: { date: string; seconds: number }[];
  tasks: { title: string; seconds: number; status: TaskStatus }[];
  members: { name: string; seconds: number }[];
  tasks_in_progress: number;
  tasks_done: number;
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
  notification_prefs: NotificationPrefs;
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
