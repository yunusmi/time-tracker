'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import { projectColor, projectName } from '@/lib/project';
import type { ProjectWithStats, TaskStatus, TaskWithStats } from '@/lib/types';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';

type Filter = 'all' | 'active' | 'done';

const STATUS_META: Record<TaskStatus, { label: string; bg: string; color: string }> = {
  todo: { label: 'К работе', bg: 'var(--surface2)', color: 'var(--muted)' },
  in_progress: { label: 'В работе', bg: 'var(--ysoft)', color: 'var(--amber)' },
  done: { label: 'Готово', bg: 'var(--gsoft)', color: 'var(--green)' },
};

export default function TasksPage() {
  const router = useRouter();
  const { version, start } = useTimer();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');

  // Форма «+ Новая задача»
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Хоткей N ведёт на /dashboard/tasks#new — открываем форму сразу.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === '#new') {
        setNewOpen(true);
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  const [newEstimate, setNewEstimate] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [projMenuOpen, setProjMenuOpen] = useState(false);
  const projMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (projMenuRef.current && !projMenuRef.current.contains(e.target as Node)) {
        setProjMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [projMenuOpen]);

  // Инлайн-переименование
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Открытый dropdown статуса
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusMenuId) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStatusMenuId(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [statusMenuId]);

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        api.listTasks(),
        api.listProjects().catch(() => [] as ProjectWithStats[]),
      ]);
      setTasks(t);
      setProjects(p);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить задачи');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const visible = tasks.filter((t) =>
    filter === 'all' ? true : filter === 'done' ? t.status === 'done' : t.status !== 'done',
  );

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await api.createTask({
        title,
        estimated_minutes: newEstimate ? Number(newEstimate) : undefined,
        project_id: newProjectId || undefined,
      });
      setNewTitle('');
      setNewEstimate('');
      setNewOpen(false);
      toast('Задача создана');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось создать задачу');
    }
  }

  async function setStatus(id: string, status: TaskStatus) {
    setStatusMenuId(null);
    try {
      await api.updateTask(id, { status });
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось изменить статус');
    }
  }

  async function saveTitle(id: string) {
    const title = editTitle.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await api.updateTask(id, { title });
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось переименовать');
    }
  }

  async function delTask(id: string) {
    try {
      await api.deleteTask(id);
      toast('Задача удалена, записи времени сохранены');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось удалить задачу');
    }
  }

  async function startTaskTimer(t: TaskWithStats) {
    try {
      // Clockify-поведение: старт нового таймера останавливает текущий (в API).
      await start({ task_id: t.id });
      router.push('/dashboard');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось запустить таймер');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div className="seg">
          {(
            [
              ['all', 'Все'],
              ['active', 'Активные'],
              ['done', 'Готово'],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-accent"
          style={{ padding: '8px 16px', fontSize: 13 }}
          onClick={() => setNewOpen((o) => !o)}
        >
          + Новая задача
        </button>
      </div>

      {newOpen && (
        <div
          className="card"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            borderColor: 'var(--accent)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 12,
          }}
        >
          <input
            className="input input-sm"
            placeholder="Название задачи"
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTask();
              if (e.key === 'Escape') setNewOpen(false);
            }}
            style={{ flex: 2 }}
          />
          <div className="menu-wrap" ref={projMenuRef} style={{ flex: 1, minWidth: 130 }}>
            <button
              className="dd-btn"
              style={{ borderRadius: 7, padding: '8px 11px' }}
              onClick={() => setProjMenuOpen((o) => !o)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  className="pdot"
                  style={{
                    background:
                      projects.find((p) => p.id === newProjectId)?.color ??
                      'var(--border2)',
                  }}
                />
                {projects.find((p) => p.id === newProjectId)?.name ?? 'Без проекта'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
            </button>
            {projMenuOpen && (
              <div className="menu">
                <div
                  className="menu-item"
                  style={{ color: 'var(--muted)' }}
                  onClick={() => {
                    setNewProjectId('');
                    setProjMenuOpen(false);
                  }}
                >
                  Без проекта
                </div>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="menu-item"
                    onClick={() => {
                      setNewProjectId(p.id);
                      setProjMenuOpen(false);
                    }}
                  >
                    <span className="pdot" style={{ background: p.color }} />
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            className="input input-sm"
            placeholder="Оценка, мин"
            value={newEstimate}
            onChange={(e) => setNewEstimate(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTask();
            }}
            style={{ width: 110 }}
          />
          <button
            className="btn btn-accent"
            style={{ borderRadius: 7, padding: '8px 16px', fontSize: 13 }}
            onClick={() => void addTask()}
          >
            Создать
          </button>
        </div>
      )}

      <div className="card">
        {visible.map((t) => {
          const meta = STATUS_META[t.status];
          const estSec = (t.estimated_minutes ?? 0) * 60;
          const pct = estSec
            ? Math.min(100, Math.round((t.total_tracked_seconds / estSec) * 100))
            : 0;
          const over = estSec > 0 && t.total_tracked_seconds > estSec;
          return (
            <div className="list-row" key={t.id} style={{ padding: '11px 16px' }}>
              <div
                className="menu-wrap"
                style={{ flexShrink: 0 }}
                ref={statusMenuId === t.id ? menuRef : undefined}
              >
                <button
                  onClick={() => setStatusMenuId(statusMenuId === t.id ? null : t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: meta.bg,
                    color: meta.color,
                    border: 'none',
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {meta.label} ▾
                </button>
                {statusMenuId === t.id && (
                  <div className="menu" style={{ right: 'auto', minWidth: 130 }}>
                    {(Object.keys(STATUS_META) as TaskStatus[]).map((st) => (
                      <div
                        key={st}
                        className="menu-item"
                        style={{ fontSize: '12.5px' }}
                        onClick={() => void setStatus(t.id, st)}
                      >
                        {STATUS_META[st].label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === t.id ? (
                  <input
                    className="input"
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveTitle(t.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => void saveTitle(t.id)}
                    style={{
                      width: '100%',
                      borderColor: 'var(--accent)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: '13.5px',
                    }}
                  />
                ) : (
                  <div
                    title="Нажмите, чтобы переименовать"
                    onClick={() => {
                      setEditingId(t.id);
                      setEditTitle(t.title);
                    }}
                    style={{
                      fontWeight: 600,
                      cursor: 'text',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textDecorationLine: t.status === 'done' ? 'line-through' : 'none',
                    }}
                  >
                    {t.title}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '11.5px',
                    color: 'var(--muted)',
                    marginTop: 2,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      className="pdot"
                      style={{ width: 6, height: 6, background: projectColor(t) }}
                    />
                    {projectName(t)}
                  </span>
                  {t.pomodoro_count > 0 && <span>· {t.pomodoro_count} pomodoro</span>}
                </div>
              </div>

              <div style={{ width: 150, flexShrink: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginBottom: 3,
                  }}
                >
                  <span className="mono">{formatHM(t.total_tracked_seconds)}</span>
                  <span>
                    {t.estimated_minutes ? `из ${formatHM(estSec)}` : 'без оценки'}
                  </span>
                </div>
                <div className="progress" style={{ height: 4 }}>
                  <div
                    style={{
                      background: over ? 'var(--amber)' : 'var(--accent)',
                      width: `${pct}%`,
                    }}
                  />
                </div>
              </div>

              <button
                className="btn-green-soft"
                title="Запустить таймер"
                style={{ border: 'none', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                onClick={() => void startTaskTimer(t)}
              >
                ▶
              </button>
              <button
                className="icon-x"
                title="Удалить задачу"
                style={{ flexShrink: 0 }}
                onClick={() => void delTask(t.id)}
              >
                ✕
              </button>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="empty">
            <div className="empty-title">Задач нет</div>
            <div className="empty-sub">
              Создайте первую — и запускайте таймер прямо из списка.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
