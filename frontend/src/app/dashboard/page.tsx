'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { SkeletonRows, SkeletonStats } from '@/components/Skeleton';
import {
  formatHM,
  formatTicker,
  formatTime,
  isoDaysAgo,
  nowHHMM,
  timeToDate,
  todayIso,
} from '@/lib/format';
import type { PomodoroStats, TaskWithStats, TimeEntry } from '@/lib/types';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useReminders } from '@/hooks/useReminders';
import { dueInfo, PRIO_META } from '@/lib/task';
import { enqueueEntry } from '@/lib/offline';
import { entryTitle } from '@/components/Header';
import { openGenerator } from '@/components/ReportGenerator';
import { TaskDropdown } from '@/components/TaskDropdown';
import {
  entryProjectColor,
  entryProjectName,
  NO_PROJECT_COLOR,
  projectColor,
} from '@/lib/project';

interface RecentItem {
  task_id: string | null;
  description: string;
  title: string;
  color: string;
}

export default function TrackerPage() {
  const {
    active,
    elapsedSeconds,
    version,
    bumpVersion,
    start,
    stop,
    setFocusMode,
    idle,
    idleMinutes,
    keepWorking,
    stopSubtractingIdle,
  } = useTimer();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [pomoStats, setPomoStats] = useState<PomodoroStats | null>(null);
  const [weekLocked, setWeekLocked] = useState(false);
  // Возвращённый таймшит: красная плашка с причиной и кнопкой «Исправить».
  const [returned, setReturned] = useState<{ comment: string | null } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Чек-лист «Первые шаги» + баннер забытого таймера (>4ч).
  const [checklistDismissed, setChecklistDismissed] = useState(true);
  const [longDismissed, setLongDismissed] = useState(false);
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    setChecklistDismissed(
      window.localStorage.getItem('tt_checklist_dismissed') === '1',
    );
    api
      .listProjects()
      .then((p) => setProjectsCount(p.length))
      .catch(() => undefined);
  }, []);

  // Строка старта
  const [timerDesc, setTimerDesc] = useState('');
  const [timerTaskId, setTimerTaskId] = useState('');

  // Форма «+ Вручную»
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDesc, setManualDesc] = useState('');
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualFrom, setManualFrom] = useState(() => nowHHMM(-60));
  const [manualTo, setManualTo] = useState(() => nowHHMM());

  // Инлайн-редактирование времени записи
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [eeFrom, setEeFrom] = useState('');
  const [eeTo, setEeTo] = useState('');
  const [eeNote, setEeNote] = useState('');

  const load = useCallback(async () => {
    try {
      const days = [0, 1, 2, 3, 4, 5, 6].map((i) => isoDaysAgo(i));
      const [t, stats, ...byDay] = await Promise.all([
        api.listTasks(),
        api.getPomodoroStats(todayIso()).catch(() => null),
        ...days.map((d) => api.listEntries(d)),
      ]);
      setTasks(t);
      setPomoStats(stats);
      setTodayEntries(byDay[0]);
      setWeekEntries(byDay.flat());
      setError('');
      setLoading(false);
      // Утверждённая неделя блокирует записи (бейдж + серверные 403).
      api
        .listTimesheets()
        .then((ts) => {
          setWeekLocked(ts.mine.status === 'approved');
          setReturned(
            ts.mine.status === 'returned' ? { comment: ts.mine.comment } : null,
          );
        })
        .catch(() => {
          setWeekLocked(false);
          setReturned(null);
        });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done'),
    [tasks],
  );

  // «Мои задачи на сегодня»: просроченные, с дедлайном сегодня или в работе.
  const myToday = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status === 'done') return false;
        const mine =
          t.assignee_id === user?.id || (!t.assignee_id && t.user_id === user?.id);
        if (!mine) return false;
        const due = dueInfo(t);
        return !!due?.overdue || !!due?.dueToday || t.status === 'in_progress';
      })
      .map((t) => {
        const due = dueInfo(t);
        return {
          id: t.id,
          title: t.title,
          prioColor: PRIO_META[t.priority ?? 'med'].color,
          label: due?.overdue
            ? 'просрочено'
            : due?.dueToday
              ? 'дедлайн сегодня'
              : 'в работе',
          labelColor: due?.overdue
            ? 'var(--red)'
            : due?.dueToday
              ? 'var(--amber)'
              : 'var(--muted)',
        };
      });
  }, [tasks, user]);

  // «Продолжить» — последние уникальные работы (по task_id/описанию), без done-задач
  const recent = useMemo<RecentItem[]>(() => {
    if (active) return [];
    const seen = new Set<string>();
    const out: RecentItem[] = [];
    const finished = weekEntries
      .filter((e) => e.ended_at)
      .sort(
        (a, b) =>
          new Date(b.ended_at as string).getTime() -
          new Date(a.ended_at as string).getTime(),
      );
    for (const e of finished) {
      const key = e.task_id || (e.description ? `d:${e.description}` : '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (e.task_id) {
        const t = tasks.find((x) => x.id === e.task_id);
        if (!t || t.status === 'done') continue;
        out.push({
          task_id: e.task_id,
          description: '',
          title: t.title,
          color: projectColor(t),
        });
      } else {
        out.push({
          task_id: null,
          description: e.description ?? '',
          title: e.description ?? '',
          color: NO_PROJECT_COLOR,
        });
      }
      if (out.length >= 3) break;
    }
    return out;
  }, [weekEntries, tasks, active]);

  const todaySec =
    todayEntries.reduce((s, e) => s + e.duration_seconds, 0) +
    (active ? elapsedSeconds : 0);
  const weekSec =
    weekEntries.reduce((s, e) => s + e.duration_seconds, 0) +
    (active ? elapsedSeconds : 0);
  const goalSec = settings.daily_goal_hours * 3600;
  const goalPct = Math.min(100, Math.round((todaySec / goalSec) * 100));

  useReminders(todaySec);

  async function onStart(taskId?: string, description?: string) {
    const tid = taskId ?? timerTaskId;
    const desc = (description ?? timerDesc).trim();
    if (!tid && !desc) {
      toast('Опишите работу или выберите задачу');
      return;
    }
    try {
      await start({ task_id: tid || undefined, description: desc || undefined });
      setTimerDesc('');
      setTimerTaskId('');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось запустить таймер');
    }
  }

  async function onStop() {
    try {
      await stop();
      toast('Таймер остановлен, запись сохранена');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось остановить таймер');
    }
  }

  async function addManual() {
    const from = timeToDate(manualFrom);
    const to = timeToDate(manualTo);
    if (to.getTime() <= from.getTime()) {
      toast('«До» должно быть позже «С»');
      return;
    }
    const body = {
      task_id: manualTaskId || undefined,
      description: manualDesc.trim() || undefined,
      started_at: from.toISOString(),
      ended_at: to.toISOString(),
    };
    // Оффлайн: сохраняем локально, синк при подключении (OfflineBanner).
    if (!navigator.onLine) {
      enqueueEntry(body);
      setManualDesc('');
      setManualOpen(false);
      toast('Оффлайн — запись сохранена локально и будет синхронизирована');
      return;
    }
    try {
      await api.createManualEntry(body);
      setManualDesc('');
      setManualOpen(false);
      toast('Запись добавлена');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось добавить запись');
    }
  }

  async function delEntry(id: string) {
    const removed = todayEntries.find((e) => e.id === id);
    try {
      await api.deleteEntry(id);
      await load();
      toast(
        'Запись удалена',
        removed && removed.ended_at
          ? async () => {
              // Undo: пересоздаём запись с теми же параметрами.
              await api.createManualEntry({
                task_id: removed.task_id ?? undefined,
                description: removed.description ?? undefined,
                started_at: removed.started_at,
                ended_at: removed.ended_at as string,
              });
              toast('Восстановлено');
              await load();
            }
          : undefined,
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось удалить запись');
    }
  }

  function startEntryEdit(e: TimeEntry) {
    setEditEntryId(e.id);
    setEeFrom(formatTime(e.started_at));
    setEeTo(e.ended_at ? formatTime(e.ended_at) : nowHHMM());
    setEeNote(e.note ?? '');
  }

  /** «✂» — режет запись пополам: первая половина + новая на вторую (ТЗ, п. 49). */
  async function splitEntry(entry: TimeEntry) {
    if (!entry.ended_at) {
      toast('Идущий таймер разрезать нельзя — сначала остановите его');
      return;
    }
    const startMs = new Date(entry.started_at).getTime();
    const endMs = new Date(entry.ended_at).getTime();
    if (endMs - startMs < 120_000) {
      toast('Запись короче двух минут — делить нечего');
      return;
    }
    const midMs = startMs + Math.round((endMs - startMs) / 2);
    const mid = new Date(midMs).toISOString();
    try {
      await api.updateEntry(entry.id, { ended_at: mid });
      await api.createManualEntry({
        task_id: entry.task_id ?? undefined,
        description: entry.task_id ? undefined : (entry.description ?? undefined),
        started_at: mid,
        ended_at: new Date(endMs).toISOString(),
      });
      bumpVersion();
      toast('Запись разрезана пополам');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось разрезать запись');
    }
  }

  async function saveEntryEdit(e: TimeEntry) {
    const base = new Date(e.started_at);
    const from = timeToDate(eeFrom, base);
    const to = timeToDate(eeTo, base);
    if (to.getTime() <= from.getTime()) {
      toast('«До» должно быть позже «С»');
      return;
    }
    try {
      await api.updateEntry(e.id, {
        started_at: from.toISOString(),
        ended_at: to.toISOString(),
        note: eeNote.trim(),
      });
      setEditEntryId(null);
      toast('Время записи обновлено');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось обновить запись');
    }
  }

  async function toggleBillable(e: TimeEntry) {
    try {
      await api.updateEntry(e.id, { billable: !e.billable });
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось изменить запись');
    }
  }

  async function exportXlsx() {
    try {
      await api.exportToday(todayIso());
    } catch {
      toast('Не удалось сформировать отчёт');
    }
  }

  const manualPreviewSec =
    (timeToDate(manualTo).getTime() - timeToDate(manualFrom).getTime()) / 1000;

  // Drag краёв записи на таймлайне: шаг 5 минут, границы 08:00–20:00.
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    startMs: number;
    endMs: number;
  } | null>(null);

  function startTimelineDrag(
    ev: React.PointerEvent<HTMLDivElement>,
    entry: TimeEntry,
  ) {
    if (!entry.ended_at) return;
    if (weekLocked) {
      toast('Неделя утверждена — записи заблокированы');
      return;
    }
    ev.preventDefault();
    const seg = ev.currentTarget.getBoundingClientRect();
    const track = ev.currentTarget.parentElement?.getBoundingClientRect();
    if (!track) return;
    const edge = ev.clientX - seg.left < seg.width / 2 ? 'start' : 'end';
    const day = new Date(entry.started_at);
    day.setHours(0, 0, 0, 0);
    let preview = {
      id: entry.id,
      startMs: new Date(entry.started_at).getTime(),
      endMs: new Date(entry.ended_at).getTime(),
    };
    setDragPreview(preview);

    const move = (e: PointerEvent) => {
      let min = 480 + ((e.clientX - track.left) / track.width) * 720;
      min = Math.max(480, Math.min(1200, Math.round(min / 5) * 5));
      const t = day.getTime() + min * 60_000;
      if (edge === 'start' && t < preview.endMs - 300_000) {
        preview = { ...preview, startMs: t };
      } else if (edge === 'end' && t > preview.startMs + 300_000) {
        preview = { ...preview, endMs: t };
      }
      setDragPreview(preview);
    };
    const up = async () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragPreview(null);
      try {
        await api.updateEntry(entry.id, {
          started_at: new Date(preview.startMs).toISOString(),
          ended_at: new Date(preview.endMs).toISOString(),
        });
        toast('Время записи обновлено');
        await load();
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Не удалось обновить запись');
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Таймлайн 08:00–20:00
  const TL_START = 8 * 60;
  const TL_SPAN = 12 * 60;
  const tlSegs = useMemo(() => {
    const segs: {
      key: string;
      left: number;
      width: number;
      color: string;
      tip: string;
      live: boolean;
    }[] = [];
    const push = (
      key: string,
      startMs: number,
      endMs: number,
      title: string,
      live: boolean,
      color: string,
    ) => {
      const d = new Date(startMs);
      const m1 = d.getHours() * 60 + d.getMinutes();
      const m2 = m1 + (endMs - startMs) / 60000;
      const left = Math.max(0, ((m1 - TL_START) / TL_SPAN) * 100);
      const right = Math.min(100, ((m2 - TL_START) / TL_SPAN) * 100);
      if (right > left) {
        segs.push({
          key,
          left,
          width: Math.max(0.6, right - left),
          color: live ? 'var(--accent)' : color,
          tip: `${title} · ${formatTime(new Date(startMs).toISOString())}–${formatTime(new Date(endMs).toISOString())}`,
          live,
        });
      }
    };
    for (const e of todayEntries) {
      if (!e.ended_at) continue;
      const isDragging = dragPreview?.id === e.id;
      push(
        e.id,
        isDragging ? dragPreview.startMs : new Date(e.started_at).getTime(),
        isDragging ? dragPreview.endMs : new Date(e.ended_at).getTime(),
        entryTitle(e),
        false,
        entryProjectColor(e),
      );
    }
    if (active) {
      push(
        '__live',
        new Date(active.started_at).getTime(),
        Date.now(),
        entryTitle(active),
        true,
        'var(--accent)',
      );
    }
    return segs;
  }, [todayEntries, active, elapsedSeconds, dragPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  // Записи за сегодня: активная сверху, дальше по убыванию времени старта
  const rows = useMemo(() => {
    const finished = todayEntries
      .filter((e) => e.ended_at)
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );
    return { finished };
  }, [todayEntries]);

  async function onIdleStop() {
    try {
      await stopSubtractingIdle();
      toast('Таймер остановлен, простой вычтен');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось остановить таймер');
    }
  }

  if (loading) {
    return (
      <div>
        <div className="sk" style={{ height: 60, borderRadius: 10, marginBottom: 14 }} />
        <SkeletonStats />
        <div className="sk" style={{ height: 74, borderRadius: 12, margin: '14px 0' }} />
        <div className="card card-pad">
          <SkeletonRows rows={4} height={44} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {/* Непринятые часы: таймшит вернули с причиной (ТЗ, «Оплата и возвраты») */}
      {returned && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--rsoft)',
            border: '1px solid var(--red)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, flex: 1, minWidth: 200 }}>
            <b>Часы за неделю не приняты.</b>{' '}
            {returned.comment ?? 'Админ вернул таймшит на доработку.'}
          </span>
          <Link href="/dashboard/timesheets" className="btn btn-red">
            Исправить
          </Link>
        </div>
      )}

      {/* Idle-баннер */}
      {idle && active && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--ysoft)',
            border: '1px solid var(--amber)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 13 }}>
            <b>Похоже, вы отошли.</b> Таймер идёт, но активности нет уже {idleMinutes} мин.
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn-outline" onClick={keepWorking}>
            Я работаю
          </button>
          <button
            style={{
              background: 'var(--amber)',
              border: 'none',
              borderRadius: 7,
              padding: '5px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#1a1206',
              cursor: 'pointer',
            }}
            onClick={() => void onIdleStop()}
          >
            Стоп и вычесть простой
          </button>
        </div>
      )}

      {/* Чек-лист «Первые шаги» */}
      {!checklistDismissed && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Первые шаги</span>
            <div style={{ flex: 1 }} />
            <button
              className="btn-outline"
              style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={() => window.dispatchEvent(new Event('tt-open-tour'))}
            >
              Тур по интерфейсу
            </button>
            <button
              className="icon-x"
              title="Скрыть"
              onClick={() => {
                setChecklistDismissed(true);
                window.localStorage.setItem('tt_checklist_dismissed', '1');
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {[
              { label: 'Создан проект', done: projectsCount > 0 },
              { label: 'Создана задача', done: tasks.length > 0 },
              {
                label: 'Запущен таймер',
                done: todayEntries.length > 0 || weekEntries.length > 0 || !!active,
              },
            ].map((c) => (
              <span
                key={c.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: '12.5px',
                  color: c.done ? 'var(--green)' : 'var(--muted)',
                }}
              >
                <span style={{ fontWeight: 700 }}>{c.done ? '✓' : '○'}</span>
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* «Забыли выключить?» — таймер идёт дольше 4 часов */}
      {active && elapsedSeconds > 4 * 3600 && !longDismissed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--ysoft)',
            border: '1px solid var(--amber)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 13 }}>
            <b>Таймер идёт уже {formatHM(elapsedSeconds)}.</b> Забыли выключить?
          </span>
          <div style={{ flex: 1 }} />
          <button
            style={{
              background: 'var(--amber)',
              border: 'none',
              borderRadius: 7,
              padding: '5px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#1a1206',
              cursor: 'pointer',
            }}
            onClick={() => void onStop()}
          >
            Остановить сейчас
          </button>
          <button className="btn-outline" onClick={() => setLongDismissed(true)}>
            Всё в порядке
          </button>
        </div>
      )}

      {/* Активный таймер / строка старта */}
      {active ? (
        <div
          className="card active-timer"
          style={{
            borderColor: 'var(--accent)',
            padding: '18px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            className="pulse"
            style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={entryTitle(active)}
            >
              {entryTitle(active)}
            </div>
            <div
              style={{
                color: 'var(--muted)',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 1,
              }}
            >
              <span className="pdot" style={{ background: entryProjectColor(active) }} />
              {entryProjectName(active)}
            </div>
          </div>
          <span
            className="mono timer-value"
            style={{ fontSize: 30, fontWeight: 600, letterSpacing: '0.01em' }}
          >
            {formatTicker(elapsedSeconds)}
          </span>
          <button
            title="Фокус-режим (F)"
            onClick={() => setFocusMode(true)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border2)',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 14,
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            ⛶
          </button>
          <button className="btn btn-red" onClick={onStop}>
            ■ Стоп
          </button>
        </div>
      ) : (
        <>
          <div
            className="card"
            style={{
              padding: '14px 16px',
              marginBottom: 16,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <input
              className="input"
              placeholder="Над чем работаете?"
              value={timerDesc}
              onChange={(e) => setTimerDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onStart();
              }}
              style={{ flex: 2, minWidth: 180 }}
            />
            <TaskDropdown
              tasks={openTasks}
              value={timerTaskId}
              placeholder="Задача (необязательно)"
              onPick={setTimerTaskId}
            />
            <button className="btn btn-accent" style={{ padding: '9px 22px' }} onClick={() => void onStart()}>
              ▶ Старт
            </button>
          </div>

          {recent.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                margin: '-6px 0 16px',
                fontSize: 12,
              }}
            >
              <span className="muted">Продолжить:</span>
              {recent.map((r, i) => (
                <button
                  key={i}
                  onClick={() => void onStart(r.task_id ?? '', r.description)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 99,
                    padding: '5px 12px',
                    fontSize: 12,
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="pdot"
                    style={{ width: 6, height: 6, background: r.color }}
                  />
                  ▶ {r.title}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Stat-карточки */}
      <div className="grid-stats" style={{ marginBottom: 16 }}>
        <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
          <div className="stat-title">Сегодня</div>
          <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0 8px' }}>
            {formatHM(todaySec)}
          </div>
          <div className="progress">
            <div style={{ background: 'var(--accent)', width: `${goalPct}%` }} />
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 5 }}>
            цель {settings.daily_goal_hours}ч · {goalPct}%
          </div>
        </div>
        <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
          <div className="stat-title">Эта неделя</div>
          <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0' }}>
            {formatHM(weekSec)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
            в среднем {formatHM(weekSec / 7)} в день
          </div>
        </div>
        <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
          <div className="stat-title">Pomodoro сегодня</div>
          <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0' }}>
            {pomoStats?.completed_work_sessions ?? 0}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
            фокус {formatHM(pomoStats?.total_focus_seconds ?? 0)}
          </div>
        </div>
      </div>

      {/* Мои задачи на сегодня */}
      {myToday.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: '11px 16px',
              borderBottom: '1px solid var(--border)',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Мои задачи на сегодня
          </div>
          {myToday.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: t.prioColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontWeight: 500,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.title}
              </span>
              <span
                style={{
                  fontSize: '11.5px',
                  color: t.labelColor,
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                {t.label}
              </span>
              <button
                className="btn-green-soft"
                title="Запустить таймер"
                style={{ border: 'none', cursor: 'pointer', padding: '5px 11px', fontSize: 12 }}
                onClick={() => void onStart(t.id, '')}
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Таймлайн дня */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span className="stat-title">Таймлайн дня</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            08:00 — 20:00
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            height: 28,
            background: 'var(--surface2)',
            borderRadius: 7,
            overflow: 'hidden',
          }}
        >
          {tlSegs.map((g) => (
            <div
              key={g.key}
              title={g.tip}
              className={g.live ? 'pulse' : undefined}
              onPointerDown={(ev) => {
                if (g.live) return;
                const entry = todayEntries.find((x) => x.id === g.key);
                if (entry) startTimelineDrag(ev, entry);
              }}
              style={{
                position: 'absolute',
                top: 3,
                bottom: 3,
                borderRadius: 4,
                background: g.color,
                left: `${g.left}%`,
                width: `${g.width}%`,
                cursor: g.live ? 'default' : 'ew-resize',
                touchAction: 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Записи за сегодня */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Записи за сегодня</span>
          {weekLocked && (
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                borderRadius: 5,
                padding: '2px 8px',
                background: 'var(--gsoft)',
                color: 'var(--green)',
              }}
            >
              неделя утверждена — заблокировано
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => openGenerator({ mode: 'standup' })}
            style={{
              background: 'var(--asoft)',
              border: '1px solid var(--accent)',
              borderRadius: 7,
              padding: '5px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--accent)',
              cursor: 'pointer',
            }}
          >
            ⚡ Стендап-отчёт
          </button>
          <button className="btn-outline" onClick={() => setManualOpen((o) => !o)}>
            + Вручную
          </button>
          <button className="btn-outline" onClick={() => void exportXlsx()}>
            ↓ Экспорт .xlsx
          </button>
        </div>

        {manualOpen && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-end',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
            }}
          >
            <div style={{ flex: 2, minWidth: 140 }}>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
                Описание
              </div>
              <input
                className="input input-sm"
                style={{ width: '100%', background: 'var(--surface)' }}
                placeholder="Что делали"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
              />
            </div>
            <div style={{ flex: 1.4, minWidth: 130, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
                Задача
              </div>
              <TaskDropdown
                tasks={openTasks}
                value={manualTaskId}
                placeholder="Без задачи"
                onPick={setManualTaskId}
                small
              />
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>С</div>
              <input
                type="time"
                className="input input-time"
                style={{ background: 'var(--surface)' }}
                value={manualFrom}
                onChange={(e) => setManualFrom(e.target.value)}
              />
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>До</div>
              <input
                type="time"
                className="input input-time"
                style={{ background: 'var(--surface)' }}
                value={manualTo}
                onChange={(e) => setManualTo(e.target.value)}
              />
            </div>
            <span className="mono" style={{ fontSize: '12.5px', color: 'var(--muted)', paddingBottom: 8 }}>
              {manualPreviewSec > 0 ? `= ${formatHM(manualPreviewSec)}` : '—'}
            </span>
            <button className="btn btn-accent" style={{ borderRadius: 7, padding: '8px 16px', fontSize: 13 }} onClick={() => void addManual()}>
              Добавить
            </button>
          </div>
        )}

        {!active && rows.finished.length === 0 && (
          <div className="empty">
            <div className="empty-title">Пока пусто</div>
            <div className="empty-sub">
              Запустите таймер или добавьте время вручную — записи появятся здесь.
            </div>
          </div>
        )}

        {active && (
          <div className="list-row">
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', width: 88, flexShrink: 0 }}>
              {formatTime(active.started_at)}–…
            </span>
            <span className="pdot" style={{ background: entryProjectColor(active) }} />
            <span
              style={{
                flex: 1,
                fontWeight: 500,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entryTitle(active)}
            </span>
            <span
              className="pulse"
              style={{
                fontSize: '10.5px',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: 5,
                padding: '1px 6px',
              }}
            >
              идёт
            </span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, width: 70, textAlign: 'right' }}>
              {formatTicker(elapsedSeconds)}
            </span>
            <span style={{ width: 22 }} />
          </div>
        )}

        {rows.finished.map((e) => (
          <div className="list-row" key={e.id}>
            {editEntryId === e.id ? (
              <span
                style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') void saveEntryEdit(e);
                  if (ev.key === 'Escape') setEditEntryId(null);
                }}
              >
                <input
                  type="time"
                  className="mono"
                  autoFocus
                  value={eeFrom}
                  onChange={(ev) => setEeFrom(ev.target.value)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--accent)',
                    borderRadius: 5,
                    padding: '2px 4px',
                    fontSize: '11.5px',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <input
                  type="time"
                  className="mono"
                  value={eeTo}
                  onChange={(ev) => setEeTo(ev.target.value)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--accent)',
                    borderRadius: 5,
                    padding: '2px 4px',
                    fontSize: '11.5px',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <input
                  value={eeNote}
                  onChange={(ev) => setEeNote(ev.target.value)}
                  placeholder="Комментарий к записи"
                  style={{
                    width: 150,
                    background: 'var(--surface2)',
                    border: '1px solid var(--accent)',
                    borderRadius: 5,
                    padding: '2px 6px',
                    fontSize: '11.5px',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => void saveEntryEdit(e)}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 5,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ✓
                </button>
              </span>
            ) : (
              <button
                className="mono"
                title="Изменить время"
                onClick={() => startEntryEdit(e)}
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  width: 88,
                  flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {formatTime(e.started_at)}–{e.ended_at ? formatTime(e.ended_at) : '…'}
              </button>
            )}
            <span className="pdot" style={{ background: entryProjectColor(e) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entryTitle(e)}
              </div>
              {e.note && (
                <div
                  style={{
                    fontSize: '11.5px',
                    color: 'var(--muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  — {e.note}
                </div>
              )}
            </div>
            {e.is_manual && <span className="chip-badge">вручную</span>}
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, width: 70, textAlign: 'right' }}>
              {formatTicker(e.duration_seconds)}
            </span>
            <button
              title="Оплачиваемое время (вкл/выкл)"
              onClick={() => void toggleBillable(e)}
              style={{
                background: e.billable === false ? 'var(--surface2)' : 'var(--gsoft)',
                color: e.billable === false ? 'var(--muted)' : 'var(--green)',
                border: 'none',
                borderRadius: 5,
                padding: '2px 7px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ₽
            </button>
            {e.ended_at && (
              <button
                className="icon-x"
                title="Разрезать запись пополам"
                onClick={() => void splitEntry(e)}
              >
                ✂
              </button>
            )}
            <button className="icon-x" title="Удалить запись" onClick={() => void delEntry(e.id)}>
              ✕
            </button>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            fontSize: '12.5px',
            color: 'var(--muted)',
          }}
        >
          Итого за день:
          <span className="mono" style={{ fontWeight: 600, color: 'var(--text)' }}>
            {formatHM(todaySec)}
          </span>
        </div>
      </div>
    </div>
  );
}
