'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { SkeletonRows } from '@/components/Skeleton';
import { formatHM } from '@/lib/format';
import { projectColor, projectName } from '@/lib/project';
import { dueInfo, PRIO_META } from '@/lib/task';
import type {
  ProjectWithStats,
  TaskPriority,
  TaskStatus,
  TaskTemplate,
  TaskWithStats,
} from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { openGenerator } from '@/components/ReportGenerator';
import { useConfirm } from '@/components/ConfirmDialog';

type Filter = 'all' | 'active' | 'done';
type View = 'list' | 'kanban';
type Who = 'all' | 'mine';

const STATUS_META: Record<TaskStatus, { label: string; bg: string; color: string }> = {
  todo: { label: 'К работе', bg: 'var(--surface2)', color: 'var(--muted)' },
  in_progress: { label: 'В работе', bg: 'var(--ysoft)', color: 'var(--amber)' },
  done: { label: 'Готово', bg: 'var(--gsoft)', color: 'var(--green)' },
};

function overdueLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} задача`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} задачи`;
  return `${n} задач`;
}

/** Небольшой локальный dropdown (кнопка + меню) с закрытием по клику вне. */
function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);
  return ref;
}

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { version, start } = useTimer();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const { isAdmin, members } = useWorkspace();

  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  // Список / Канбан (ТЗ, п. 54): в канбане статус меняется стрелками ‹ ›.
  const [view, setView] = useState<View>('list');
  const [who, setWho] = useState<Who>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Форма «+ Новая задача»
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEstimate, setNewEstimate] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPrio, setNewPrio] = useState<TaskPriority>('med');
  const [newDue, setNewDue] = useState('');
  const [newLink, setNewLink] = useState('');

  const [openMenu, setOpenMenu] = useState<null | 'proj' | 'assignee' | 'prio'>(null);
  const menuRef = useOutsideClose(openMenu !== null, () => setOpenMenu(null));

  // Инлайн-переименование
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Открытый dropdown статуса
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const statusRef = useOutsideClose(statusMenuId !== null, () => setStatusMenuId(null));

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

  const load = useCallback(async () => {
    try {
      const [t, p, tpl] = await Promise.all([
        api.listTasks(isAdmin && who === 'mine' ? 'mine' : undefined),
        api.listProjects().catch(() => [] as ProjectWithStats[]),
        api.listTaskTemplates().catch(() => [] as TaskTemplate[]),
      ]);
      setTasks(t);
      setProjects(p);
      setTemplates(tpl);
      setError('');
      setLoading(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить задачи');
      setLoading(false);
    }
  }, [isAdmin, who]);

  useEffect(() => {
    void load();
  }, [load, version]);

  // Групповые действия: чекбоксы + панель «Выбрано: N».
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action: 'todo' | 'in_progress' | 'done' | 'delete') {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'delete') {
      const ok = await confirm({
        title: 'Удалить выбранные задачи?',
        description: `Будет удалено задач: ${ids.length}. Записи времени останутся, но потеряют привязку к задаче.`,
      });
      if (!ok) return;
    }
    try {
      const { updated } = await api.bulkTasks(ids, action);
      setSelected(new Set());
      toast(
        action === 'delete'
          ? `Удалено задач: ${updated}`
          : `Изменено задач: ${updated}`,
      );
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось выполнить действие');
    }
  }

  const visible = tasks.filter((t) =>
    filter === 'all' ? true : filter === 'done' ? t.status === 'done' : t.status !== 'done',
  );

  const overdueCount = useMemo(
    () => tasks.filter((t) => dueInfo(t)?.overdue).length,
    [tasks],
  );

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await api.createTask({
        title,
        estimated_minutes: newEstimate ? Number(newEstimate) : undefined,
        project_id: newProjectId || undefined,
        assignee_id: newAssigneeId || undefined,
        priority: newPrio,
        due_date: newDue || undefined,
        external_url: newLink.trim() || undefined,
      });
      setNewTitle('');
      setNewEstimate('');
      setNewDue('');
      setNewLink('');
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
    const removed = tasks.find((t) => t.id === id);
    // Задача с записями времени удаляется только после подтверждения (ТЗ).
    if (removed && removed.total_tracked_seconds > 0) {
      const ok = await confirm({
        title: 'Удалить задачу с записями?',
        description: `«${removed.title}» — затрекано ${Math.round(removed.total_tracked_seconds / 60)} мин. Записи времени останутся в отчётах, но потеряют привязку к задаче.`,
      });
      if (!ok) return;
    }
    try {
      await api.deleteTask(id);
      await load();
      toast(
        'Задача удалена',
        removed
          ? async () => {
              // Undo: пересоздаём задачу с теми же полями.
              await api.createTask({
                title: removed.title,
                description: removed.description ?? undefined,
                estimated_minutes: removed.estimated_minutes ?? undefined,
                status: removed.status,
                project_id: removed.project_id ?? undefined,
                assignee_id: removed.assignee_id ?? undefined,
                external_url: removed.external_url ?? undefined,
                priority: removed.priority,
                due_date: removed.due_date ?? undefined,
              });
              toast('Восстановлено');
              await load();
            }
          : undefined,
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось удалить задачу');
    }
  }

  async function saveTemplate() {
    const title = newTitle.trim();
    if (!title) {
      toast('Введите название задачи');
      return;
    }
    try {
      await api.createTaskTemplate({
        title,
        project_id: newProjectId || undefined,
        estimated_minutes: newEstimate ? Number(newEstimate) : undefined,
      });
      toast('Шаблон сохранён');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить шаблон');
    }
  }

  async function applyTemplate(tpl: TaskTemplate) {
    try {
      await api.createTask({
        title: tpl.title,
        project_id: tpl.project_id ?? undefined,
        estimated_minutes: tpl.estimated_minutes ?? undefined,
      });
      toast('Задача из шаблона создана');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось создать задачу');
    }
  }

  async function removeTemplate(id: string) {
    try {
      await api.deleteTaskTemplate(id);
      await load();
    } catch {
      toast('Не удалось удалить шаблон');
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

  const selProject = projects.find((p) => p.id === newProjectId);
  const selAssignee = members.find((m) => m.user_id === newAssigneeId);

  if (loading) {
    return (
      <div className="card card-pad">
        <SkeletonRows rows={5} height={48} />
      </div>
    );
  }

  return (
    <div>
      {dialog}
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
        {isAdmin && (
          <div className="seg">
            {(
              [
                ['all', 'Все сотрудники'],
                ['mine', 'Мои'],
              ] as [Who, string][]
            ).map(([w, label]) => (
              <button key={w} className={who === w ? 'on' : ''} onClick={() => setWho(w)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="seg">
          {(
            [
              ['list', 'Список'],
              ['kanban', 'Канбан'],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {isAdmin && (
          <button
            className="btn-ghost"
            style={{ padding: '8px 14px', fontSize: 13 }}
            onClick={() => openGenerator({ mode: 'notes' })}
          >
            Release notes
          </button>
        )}
        <button
          className="btn btn-accent"
          style={{ padding: '8px 16px', fontSize: 13 }}
          onClick={() => setNewOpen((o) => !o)}
        >
          + Новая задача
        </button>
      </div>

      {overdueCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--rsoft)',
            border: '1px solid var(--red)',
            borderRadius: 10,
            padding: '9px 14px',
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <b>Просрочено: {overdueLabel(overdueCount)}</b> — пересмотрите дедлайны или
          закройте задачи.
        </div>
      )}

      {newOpen && (
        <div
          className="card"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
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
            style={{ flex: 2, minWidth: 160 }}
          />

          {/* Проект */}
          <div
            className="menu-wrap"
            ref={openMenu === 'proj' ? menuRef : undefined}
            style={{ flex: 1, minWidth: 110 }}
          >
            <button
              className="dd-btn"
              style={{ borderRadius: 7, padding: '8px 11px' }}
              onClick={() => setOpenMenu(openMenu === 'proj' ? null : 'proj')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  className="pdot"
                  style={{ background: selProject?.color ?? 'var(--border2)' }}
                />
                {selProject?.name ?? 'Без проекта'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
            </button>
            {openMenu === 'proj' && (
              <div className="menu">
                <div
                  className="menu-item"
                  style={{ color: 'var(--muted)' }}
                  onClick={() => {
                    setNewProjectId('');
                    setOpenMenu(null);
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
                      setOpenMenu(null);
                    }}
                  >
                    <span className="pdot" style={{ background: p.color }} />
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Исполнитель (admin+) */}
          {isAdmin && members.length > 0 && (
            <div
              className="menu-wrap"
              ref={openMenu === 'assignee' ? menuRef : undefined}
              style={{ flex: 1, minWidth: 110 }}
            >
              <button
                className="dd-btn"
                style={{ borderRadius: 7, padding: '8px 11px' }}
                onClick={() => setOpenMenu(openMenu === 'assignee' ? null : 'assignee')}
              >
                <span>{selAssignee ? selAssignee.name : 'Себе'}</span>
                <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
              </button>
              {openMenu === 'assignee' && (
                <div className="menu">
                  <div
                    className="menu-item"
                    style={{ color: 'var(--muted)' }}
                    onClick={() => {
                      setNewAssigneeId('');
                      setOpenMenu(null);
                    }}
                  >
                    Себе
                  </div>
                  {members
                    .filter((m) => m.user_id !== user?.id)
                    .map((m) => (
                      <div
                        key={m.user_id}
                        className="menu-item"
                        onClick={() => {
                          setNewAssigneeId(m.user_id);
                          setOpenMenu(null);
                        }}
                      >
                        {m.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Приоритет */}
          <div className="menu-wrap" ref={openMenu === 'prio' ? menuRef : undefined} style={{ flexShrink: 0 }}>
            <button
              onClick={() => setOpenMenu(openMenu === 'prio' ? null : 'prio')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '8px 11px',
                fontSize: 13,
                color: PRIO_META[newPrio].color,
                cursor: 'pointer',
              }}
            >
              {PRIO_META[newPrio].label}
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
            </button>
            {openMenu === 'prio' && (
              <div className="menu" style={{ right: 'auto', minWidth: 120 }}>
                {(Object.keys(PRIO_META) as TaskPriority[]).map((p) => (
                  <div
                    key={p}
                    className="menu-item"
                    style={{ fontSize: '12.5px', color: PRIO_META[p].color }}
                    onClick={() => {
                      setNewPrio(p);
                      setOpenMenu(null);
                    }}
                  >
                    {PRIO_META[p].label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            type="date"
            className="input input-time"
            title="Дедлайн"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            style={{ fontSize: '12.5px', padding: '7px 9px' }}
          />
          <input
            className="input input-sm"
            placeholder="Оценка, мин"
            value={newEstimate}
            onChange={(e) => setNewEstimate(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTask();
            }}
            style={{ width: 90 }}
          />
          <input
            className="input input-sm"
            placeholder="Ссылка (Notion/Jira)"
            title="Ссылка на задачу во внешней системе — попадёт в стендап-отчёт"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTask();
            }}
            style={{ flex: 1, minWidth: 140 }}
          />
          <button
            className="btn btn-accent"
            style={{ borderRadius: 7, padding: '8px 16px', fontSize: 13 }}
            onClick={() => void addTask()}
          >
            Создать
          </button>
          <button
            className="btn-outline"
            title="Сохранить как шаблон"
            style={{ padding: '8px 12px', color: 'var(--muted)' }}
            onClick={() => void saveTemplate()}
          >
            В шаблон
          </button>
        </div>
      )}

      {templates.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--muted)' }}>Шаблоны:</span>
          {templates.map((tpl) => (
            <span
              key={tpl.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 99,
                padding: '5px 6px 5px 12px',
                fontSize: 12,
              }}
            >
              <button
                onClick={() => void applyTemplate(tpl)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 12,
                }}
              >
                ＋ {tpl.title}
              </button>
              <button
                className="icon-x"
                title="Удалить шаблон"
                style={{ fontSize: 11, padding: '0 3px' }}
                onClick={() => void removeTemplate(tpl.id)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span style={{ fontWeight: 600 }}>Выбрано: {selected.size}</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={() => void bulk('in_progress')}>
            В работу
          </button>
          <button className="btn btn-ghost" onClick={() => void bulk('done')}>
            Готово
          </button>
          <button className="btn btn-red" onClick={() => void bulk('delete')}>
            Удалить
          </button>
          <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
            Снять
          </button>
        </div>
      )}

      {view === 'kanban' ? (
        <div className="kanban">
          {(
            [
              ['todo', 'К работе'],
              ['in_progress', 'В работе'],
              ['done', 'Готово'],
            ] as [TaskStatus, string][]
          ).map(([col, label]) => {
            const cards = tasks.filter((t) => t.status === col);
            return (
              <div key={col} className="card card-pad kanban-col">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                  <span className="chip-badge">{cards.length}</span>
                </div>
                {cards.map((t) => {
                  const due = dueInfo(t);
                  return (
                    <div key={t.id} className="kanban-card">
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            marginTop: 6,
                            flexShrink: 0,
                            background:
                              t.priority === 'high'
                                ? 'var(--red)'
                                : t.priority === 'low'
                                  ? 'var(--muted)'
                                  : 'var(--amber)',
                          }}
                        />
                        <span style={{ flex: 1, fontSize: '13px', fontWeight: 500 }}>
                          {t.title}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 8,
                          fontSize: 11,
                          color: 'var(--muted)',
                        }}
                      >
                        {t.project && (
                          <span
                            className="pdot"
                            style={{ background: t.project.color }}
                            title={t.project.name}
                          />
                        )}
                        <span className="mono">{formatHM(t.total_tracked_seconds)}</span>
                        {due && (
                          <span style={{ color: due.overdue ? 'var(--red)' : 'var(--muted)' }}>
                            {due.label}
                          </span>
                        )}
                        <div style={{ flex: 1 }} />
                        <button
                          className="icon-x"
                          title="Левее по статусу"
                          disabled={col === 'todo'}
                          onClick={() =>
                            void setStatus(t.id, col === 'done' ? 'in_progress' : 'todo')
                          }
                        >
                          ‹
                        </button>
                        <button
                          className="icon-x"
                          title="Правее по статусу"
                          disabled={col === 'done'}
                          onClick={() =>
                            void setStatus(t.id, col === 'todo' ? 'in_progress' : 'done')
                          }
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <div className="muted" style={{ fontSize: '12.5px' }}>
                    Пусто
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
      <div className="card">
        {visible.map((t) => {
          const meta = STATUS_META[t.status];
          const estSec = (t.estimated_minutes ?? 0) * 60;
          const pct = estSec
            ? Math.min(100, Math.round((t.total_tracked_seconds / estSec) * 100))
            : 0;
          const over = estSec > 0 && t.total_tracked_seconds > estSec;
          const due = dueInfo(t);
          const assigneeName =
            t.assignee_id === user?.id || !t.assignee
              ? 'Вы'
              : t.assignee.name.split(' ')[0];
          return (
            <div className="list-row" key={t.id} style={{ padding: '11px 16px' }}>
              <input
                type="checkbox"
                title="Выбрать для группового действия"
                checked={selected.has(t.id)}
                onChange={() => toggleSelected(t.id)}
                style={{ accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
              />
              <div
                className="menu-wrap"
                style={{ flexShrink: 0 }}
                ref={statusMenuId === t.id ? statusRef : undefined}
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
                    flexWrap: 'wrap',
                    columnGap: 8,
                    rowGap: 1,
                    fontSize: '11.5px',
                    color: 'var(--muted)',
                    marginTop: 2,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                    <span
                      className="pdot"
                      style={{ width: 6, height: 6, background: projectColor(t) }}
                    />
                    {projectName(t)}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>· {assigneeName}</span>
                  <span
                    style={{
                      color: PRIO_META[t.priority ?? 'med'].color,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    · {PRIO_META[t.priority ?? 'med'].label}
                  </span>
                  {due && (
                    <span style={{ color: due.color, whiteSpace: 'nowrap' }}>
                      · {due.label}
                    </span>
                  )}
                  {t.external_url && (
                    <a
                      href={t.external_url}
                      target="_blank"
                      rel="noreferrer"
                      title={t.external_url}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'var(--accent)', whiteSpace: 'nowrap', textDecoration: 'none' }}
                    >
                      · 🔗 ссылка
                    </a>
                  )}
                  {t.pomodoro_count > 0 && (
                    <span style={{ whiteSpace: 'nowrap' }}>· {t.pomodoro_count} pomodoro</span>
                  )}
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
      )}
    </div>
  );
}
