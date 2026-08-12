export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
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
  created_at: string;
  task_id: string | null;
  task?: Task | null;
}

export interface DaySummary {
  date: string;
  total_seconds: number;
  by_project: { project_id: string | null; seconds: number }[];
  by_task: {
    task_id: string;
    task_title: string;
    project_id: string | null;
    seconds: number;
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

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceMemberView {
  user_id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  active_task_title: string | null;
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

export interface UserSettingsResponse {
  id: string;
  daily_goal_hours: number;
  idle_threshold_minutes: number;
  notify_day_start: boolean;
  notify_goal_reached: boolean;
  theme: 'dark' | 'light';
  updated_at: string;
  user_id: string;
}

export interface PomodoroStats {
  date: string;
  completed_work_sessions: number;
  total_focus_seconds: number;
  total_break_seconds: number;
}
