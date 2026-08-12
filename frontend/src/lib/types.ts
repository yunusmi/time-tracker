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

export interface PomodoroSettings {
  id: string;
  work_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  long_break_interval: number;
  auto_start: boolean;
  updated_at: string;
}

export interface PomodoroStats {
  date: string;
  completed_work_sessions: number;
  total_focus_seconds: number;
  total_break_seconds: number;
}
