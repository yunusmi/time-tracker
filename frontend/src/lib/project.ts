import type { Project, Task } from './types';

/** Палитра проектов из дизайна (свотчи на экране «Проекты»). */
export const PROJECT_COLORS = [
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#34d399',
  '#a78bfa',
  '#f87171',
] as const;

export const NO_PROJECT_COLOR = 'var(--border2)';

type WithProject = { project?: Project | null } | null | undefined;

export function projectColor(task: WithProject): string {
  return task?.project?.color ?? NO_PROJECT_COLOR;
}

export function projectName(task: WithProject): string {
  return task?.project?.name ?? 'Без проекта';
}

/** Цвет/имя проекта записи времени (через её задачу). */
export function entryProjectColor(entry: { task?: Task | null }): string {
  return projectColor(entry.task);
}

export function entryProjectName(entry: { task?: Task | null }): string {
  return projectName(entry.task);
}
