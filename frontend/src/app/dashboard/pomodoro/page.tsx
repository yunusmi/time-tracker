'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatClock, formatDuration, todayIso } from '@/lib/format';
import type {
  PomodoroPhase,
  PomodoroSettings,
  PomodoroStats,
  TaskWithStats,
} from '@/lib/types';

const PHASE_LABEL: Record<PomodoroPhase, string> = {
  work: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
};

function phaseSeconds(phase: PomodoroPhase, s: PomodoroSettings): number {
  if (phase === 'work') return s.work_minutes * 60;
  if (phase === 'short_break') return s.short_break_minutes * 60;
  return s.long_break_minutes * 60;
}

export default function PomodoroPage() {
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [stats, setStats] = useState<PomodoroStats | null>(null);
  const [error, setError] = useState('');

  const [phase, setPhase] = useState<PomodoroPhase>('work');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completedWork, setCompletedWork] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  const deadlineRef = useRef<number>(0);
  // Mirrors of state read inside the interval to avoid stale closures.
  const refs = useRef({
    phase,
    settings,
    selectedTaskId,
    completedWork,
  });
  refs.current = { phase, settings, selectedTaskId, completedWork };

  const refreshStats = useCallback(async () => {
    try {
      setStats(await api.getPomodoroStats(todayIso()));
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, t] = await Promise.all([
          api.getPomodoroSettings(),
          api.listTasks(),
        ]);
        setSettings(s);
        setTasks(t);
        setSecondsLeft(s.work_minutes * 60);
        await refreshStats();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Failed to load pomodoro',
        );
      }
    })();
  }, [refreshStats]);

  const handleComplete = useCallback(async () => {
    const { phase: curPhase, settings: s, selectedTaskId: taskId } =
      refs.current;
    if (!s) return;
    const duration = phaseSeconds(curPhase, s);
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - duration * 1000);

    try {
      await api.createPomodoroSession({
        phase: curPhase,
        duration_seconds: duration,
        completed: true,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        task_id: curPhase === 'work' && taskId ? taskId : undefined,
      });
    } catch {
      /* ignore recording errors, keep the timer flowing */
    }

    // Decide the next phase.
    let nextPhase: PomodoroPhase;
    let nextCompleted = refs.current.completedWork;
    if (curPhase === 'work') {
      nextCompleted += 1;
      setCompletedWork(nextCompleted);
      nextPhase =
        nextCompleted % s.long_break_interval === 0
          ? 'long_break'
          : 'short_break';
    } else {
      nextPhase = 'work';
    }

    setPhase(nextPhase);
    const nextSeconds = phaseSeconds(nextPhase, s);
    setSecondsLeft(nextSeconds);

    if (s.auto_start) {
      deadlineRef.current = Date.now() + nextSeconds * 1000;
      setRunning(true);
    } else {
      setRunning(false);
    }

    await refreshStats();
    notify(`${PHASE_LABEL[curPhase]} done!`);
  }, [refreshStats]);

  // Deadline-based ticking.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = Math.round((deadlineRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        clearInterval(id);
        void handleComplete();
      } else {
        setSecondsLeft(remaining);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, handleComplete]);

  function start() {
    deadlineRef.current = Date.now() + secondsLeft * 1000;
    setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    if (settings) setSecondsLeft(phaseSeconds(phase, settings));
  }
  function switchPhase(p: PomodoroPhase) {
    setRunning(false);
    setPhase(p);
    if (settings) setSecondsLeft(phaseSeconds(p, settings));
  }

  async function saveSettings(patch: Partial<PomodoroSettings>) {
    if (!settings) return;
    try {
      const updated = await api.updatePomodoroSettings(patch);
      setSettings(updated);
      if (!running) setSecondsLeft(phaseSeconds(phase, updated));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    }
  }

  if (!settings) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ textAlign: 'center' }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          {(['work', 'short_break', 'long_break'] as PomodoroPhase[]).map(
            (p) => (
              <button
                key={p}
                className={p === phase ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                onClick={() => switchPhase(p)}
              >
                {PHASE_LABEL[p]}
              </button>
            ),
          )}
        </div>

        <div className={`pomo-circle pomo-${phase}`}>
          <span className="pomo-time mono">{formatClock(secondsLeft)}</span>
          <span className="muted">{PHASE_LABEL[phase]}</span>
        </div>

        <div className="row" style={{ justifyContent: 'center' }}>
          {!running ? (
            <button className="btn-primary" onClick={start}>
              ▶ Start
            </button>
          ) : (
            <button className="btn-ghost" onClick={pause}>
              ⏸ Pause
            </button>
          )}
          <button className="btn-ghost" onClick={reset}>
            ↺ Reset
          </button>
        </div>

        <div style={{ marginTop: '1rem', maxWidth: 360, margin: '1rem auto 0' }}>
          <label>Linked task (for focus sessions)</label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
          >
            <option value="">No task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {stats && (
        <div className="card">
          <h2>Today</h2>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-value">{stats.completed_work_sessions}</div>
              <div className="stat-label">Pomodoros 🍅</div>
            </div>
            <div className="stat">
              <div className="stat-value mono">
                {formatDuration(stats.total_focus_seconds)}
              </div>
              <div className="stat-label">Focus time</div>
            </div>
            <div className="stat">
              <div className="stat-value mono">
                {formatDuration(stats.total_break_seconds)}
              </div>
              <div className="stat-label">Break time</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Settings</h2>
        <div className="row">
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Focus (min)</label>
            <input
              type="number"
              min={1}
              max={180}
              defaultValue={settings.work_minutes}
              onBlur={(e) =>
                saveSettings({ work_minutes: Number(e.target.value) })
              }
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Short break (min)</label>
            <input
              type="number"
              min={1}
              max={60}
              defaultValue={settings.short_break_minutes}
              onBlur={(e) =>
                saveSettings({ short_break_minutes: Number(e.target.value) })
              }
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Long break (min)</label>
            <input
              type="number"
              min={1}
              max={120}
              defaultValue={settings.long_break_minutes}
              onBlur={(e) =>
                saveSettings({ long_break_minutes: Number(e.target.value) })
              }
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Long break every</label>
            <input
              type="number"
              min={1}
              max={12}
              defaultValue={settings.long_break_interval}
              onBlur={(e) =>
                saveSettings({ long_break_interval: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <label style={{ marginTop: '0.75rem' }}>
          <input
            type="checkbox"
            checked={settings.auto_start}
            onChange={(e) => saveSettings({ auto_start: e.target.checked })}
            style={{ width: 'auto', marginRight: '0.5rem' }}
          />
          Auto-start the next interval
        </label>
      </div>
    </div>
  );
}

function notify(message: string) {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(message);
  }
}
