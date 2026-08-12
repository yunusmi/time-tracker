'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
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
import { useSettings } from '@/context/SettingsContext';
import { useReminders } from '@/hooks/useReminders';
import { entryTitle } from '@/components/Header';
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

  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [pomoStats, setPomoStats] = useState<PomodoroStats | null>(null);
  const [error, setError] = useState('');

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done'),
    [tasks],
  );

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
    try {
      await api.createManualEntry({
        task_id: manualTaskId || undefined,
        description: manualDesc.trim() || undefined,
        started_at: from.toISOString(),
        ended_at: to.toISOString(),
      });
      setManualDesc('');
      setManualOpen(false);
      toast('Запись добавлена');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось добавить запись');
    }
  }

  async function delEntry(id: string) {
    try {
      await api.deleteEntry(id);
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось удалить запись');
    }
  }

  function startEntryEdit(e: TimeEntry) {
    setEditEntryId(e.id);
    setEeFrom(formatTime(e.started_at));
    setEeTo(e.ended_at ? formatTime(e.ended_at) : nowHHMM());
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
      });
      setEditEntryId(null);
      toast('Время записи обновлено');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось обновить запись');
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
      push(
        e.id,
        new Date(e.started_at).getTime(),
        new Date(e.ended_at).getTime(),
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
  }, [todayEntries, active, elapsedSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div>
      {error && <p className="error">{error}</p>}

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

      {/* Активный таймер / строка старта */}
      {active ? (
        <div
          className="card"
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
            <div style={{ fontWeight: 600, fontSize: 15 }}>{entryTitle(active)}</div>
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
          <span className="mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '0.01em' }}>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
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
              style={{
                position: 'absolute',
                top: 3,
                bottom: 3,
                borderRadius: 4,
                background: g.color,
                left: `${g.left}%`,
                width: `${g.width}%`,
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
          <div style={{ flex: 1 }} />
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
              {entryTitle(e)}
            </span>
            {e.is_manual && <span className="chip-badge">вручную</span>}
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, width: 70, textAlign: 'right' }}>
              {formatTicker(e.duration_seconds)}
            </span>
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
