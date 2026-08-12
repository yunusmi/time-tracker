'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  formatDuration,
  formatTime,
  toDatetimeLocal,
  todayIso,
} from '@/lib/format';
import type { TaskWithStats, TimeEntry } from '@/lib/types';

function defaultFrom(): string {
  return toDatetimeLocal(new Date(Date.now() - 25 * 60 * 1000));
}
function defaultTo(): string {
  return toDatetimeLocal(new Date());
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');

  // Quick timer form
  const [timerDesc, setTimerDesc] = useState('');
  const [timerTaskId, setTimerTaskId] = useState('');

  // New task form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEstimate, setNewEstimate] = useState('');

  // Manual entry form (from / to)
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualFrom, setManualFrom] = useState(defaultFrom);
  const [manualTo, setManualTo] = useState(defaultTo);

  const load = useCallback(async () => {
    try {
      const [t, a, e] = await Promise.all([
        api.listTasks(),
        api.activeEntry(),
        api.listEntries(todayIso()),
      ]);
      setTasks(t);
      setActive(a);
      setEntries(e);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load data');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Tick once per second for the running timer.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const activeElapsed = active
    ? Math.floor((now - new Date(active.started_at).getTime()) / 1000)
    : 0;

  async function startTimer(taskId?: string, description?: string) {
    setError('');
    try {
      await api.startTimer({
        task_id: taskId || undefined,
        description: description || undefined,
      });
      setTimerDesc('');
      setTimerTaskId('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start timer');
    }
  }

  async function stopTimer() {
    try {
      await api.stopTimer();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to stop timer');
    }
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await api.createTask({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        estimated_minutes: newEstimate ? Number(newEstimate) : undefined,
      });
      setNewTitle('');
      setNewDesc('');
      setNewEstimate('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create task');
    }
  }

  async function toggleDone(task: TaskWithStats) {
    try {
      await api.updateTask(task.id, {
        status: task.status === 'done' ? 'todo' : 'done',
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update task');
    }
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task? Its time entries will be unlinked.')) return;
    try {
      await api.deleteTask(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete task');
    }
  }

  async function addManualEntry(e: FormEvent) {
    e.preventDefault();
    if (!manualFrom || !manualTo) {
      setError('Set both the from and to time');
      return;
    }
    const startedAt = new Date(manualFrom);
    const endedAt = new Date(manualTo);
    if (endedAt.getTime() <= startedAt.getTime()) {
      setError('"To" must be after "From"');
      return;
    }
    try {
      await api.createManualEntry({
        task_id: manualTaskId || undefined,
        description: manualDesc.trim() || undefined,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
      });
      setManualTaskId('');
      setManualDesc('');
      setManualFrom(defaultFrom());
      setManualTo(defaultTo());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add entry');
    }
  }

  async function deleteEntry(id: string) {
    try {
      await api.deleteEntry(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete entry');
    }
  }

  async function exportToday() {
    try {
      await api.exportToday(todayIso());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export failed');
    }
  }

  const todayTotal = entries.reduce((s, e) => s + e.duration_seconds, 0);
  const manualPreview = (() => {
    const from = new Date(manualFrom);
    const to = new Date(manualTo);
    const diff = Math.round((to.getTime() - from.getTime()) / 1000);
    return diff > 0 ? formatDuration(diff) : '—';
  })();

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {/* Active timer / quick start */}
      <div className="card">
        <div className="row-between">
          <div>
            <h2 style={{ marginBottom: 0 }}>
              {active ? 'Timer running' : 'Start a timer'}
            </h2>
            <span className="muted">
              {active
                ? active.task?.title ||
                  active.description ||
                  'Untitled session'
                : 'Track time live, like Clockify'}
            </span>
          </div>
          <div className="row">
            <span className="timer-display mono">
              {formatDuration(activeElapsed)}
            </span>
            {active ? (
              <button className="btn-danger" onClick={stopTimer}>
                Stop
              </button>
            ) : null}
          </div>
        </div>

        {!active && (
          <div className="row" style={{ marginTop: '1rem' }}>
            <input
              placeholder="What are you working on?"
              value={timerDesc}
              onChange={(e) => setTimerDesc(e.target.value)}
              style={{ flex: 2, minWidth: 200 }}
            />
            <select
              value={timerTaskId}
              onChange={(e) => setTimerTaskId(e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            >
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={() => startTimer(timerTaskId, timerDesc)}
            >
              Start
            </button>
          </div>
        )}
      </div>

      {/* New task */}
      <div className="card">
        <h2>New task</h2>
        <form onSubmit={createTask}>
          <div className="row">
            <input
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 2, minWidth: 200 }}
              required
            />
            <input
              placeholder="Estimate (min)"
              type="number"
              min={0}
              value={newEstimate}
              onChange={(e) => setNewEstimate(e.target.value)}
              style={{ width: 140 }}
            />
            <button className="btn-primary" type="submit">
              Add task
            </button>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            style={{ marginTop: '0.75rem' }}
          />
        </form>
      </div>

      {/* Task list */}
      <div className="card">
        <h2>Tasks</h2>
        {tasks.length === 0 && <p className="muted">No tasks yet.</p>}
        <ul className="list-reset">
          {tasks.map((task) => (
            <li key={task.id} className="task-item">
              <input
                type="checkbox"
                checked={task.status === 'done'}
                onChange={() => toggleDone(task)}
                style={{ width: 'auto' }}
                title="Mark as done"
              />
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: '0.5rem' }}>
                  <span className="task-title">{task.title}</span>
                  <span className={`badge badge-${task.status}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: '0.83rem' }}>
                  <span className="mono">
                    {formatDuration(task.total_tracked_seconds)}
                  </span>{' '}
                  tracked
                  {task.estimated_minutes
                    ? ` · est. ${task.estimated_minutes}m`
                    : ''}
                  {task.pomodoro_count
                    ? ` · 🍅 ${task.pomodoro_count}`
                    : ''}
                </div>
              </div>
              <button
                className="btn-success btn-sm"
                onClick={() => startTimer(task.id, task.title)}
                disabled={!!active}
                title={active ? 'Stop the running timer first' : 'Start timer'}
              >
                ▶ Start
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => deleteTask(task.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Manual entry: from / to */}
      <div className="card">
        <h2>Add time manually</h2>
        <p className="muted" style={{ marginTop: '-0.4rem' }}>
          Pick the start (from) and end (to) time — duration is calculated
          automatically{manualPreview !== '—' ? ` (${manualPreview})` : ''}.
        </p>
        <form onSubmit={addManualEntry}>
          <div className="row">
            <select
              value={manualTaskId}
              onChange={(e) => setManualTaskId(e.target.value)}
              style={{ flex: 1, minWidth: 150 }}
            >
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <input
              placeholder="Description"
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              style={{ flex: 2, minWidth: 160 }}
            />
          </div>
          <div className="row" style={{ marginTop: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>From</label>
              <input
                type="datetime-local"
                value={manualFrom}
                onChange={(e) => setManualFrom(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>To</label>
              <input
                type="datetime-local"
                value={manualTo}
                onChange={(e) => setManualTo(e.target.value)}
                required
              />
            </div>
            <button
              className="btn-primary"
              type="submit"
              style={{ alignSelf: 'flex-end' }}
            >
              Add
            </button>
          </div>
        </form>
      </div>

      {/* Today's entries + export */}
      <div className="card">
        <div className="row-between">
          <h2 style={{ marginBottom: 0 }}>Today</h2>
          <div className="row">
            <span className="muted">
              Total: <span className="mono">{formatDuration(todayTotal)}</span>
            </span>
            <button className="btn-primary" onClick={exportToday}>
              ⬇ Export to Excel
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            No time tracked today yet.
          </p>
        ) : (
          <ul className="list-reset" style={{ marginTop: '0.75rem' }}>
            {entries.map((entry) => (
              <li key={entry.id} className="task-item">
                <div style={{ flex: 1 }}>
                  <span className="task-title">
                    {entry.task?.title || entry.description || 'Untitled'}
                  </span>
                  <div className="muted" style={{ fontSize: '0.83rem' }}>
                    {formatTime(entry.started_at)} –{' '}
                    {entry.ended_at ? formatTime(entry.ended_at) : 'running'} ·{' '}
                    {entry.is_manual ? 'manual' : 'timer'}
                  </div>
                </div>
                <span className="mono">
                  {formatDuration(entry.duration_seconds)}
                </span>
                {!active || active.id !== entry.id ? (
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
