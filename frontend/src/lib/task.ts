import type { TaskPriority, TaskWithStats } from './types';

export const PRIO_META: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: 'Высокий', color: 'var(--red)' },
  med: { label: 'Средний', color: 'var(--amber)' },
  low: { label: 'Низкий', color: 'var(--muted)' },
};

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Дедлайн задачи: {label, color, overdue, dueToday} или null. */
export function dueInfo(
  task: Pick<TaskWithStats, 'due_date' | 'status'>,
): { label: string; color: string; overdue: boolean; dueToday: boolean } | null {
  if (!task.due_date) return null;
  const due = new Date(`${task.due_date}T00:00:00`);
  const start = todayStart().getTime();
  const overdue = task.status !== 'done' && due.getTime() < start;
  const dueToday = due.getTime() === start;
  const dateLabel = due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return {
    label: overdue ? `просрочено · ${dateLabel}` : `до ${dateLabel}`,
    color: overdue ? 'var(--red)' : 'var(--muted)',
    overdue,
    dueToday,
  };
}
