'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatClock, formatHM, todayIso } from '@/lib/format';
import type { PomodoroPhase, PomodoroStats, TaskWithStats } from '@/lib/types';
import {
  PHASE_LABEL,
  phaseSeconds,
  usePomodoro,
} from '@/context/PomodoroContext';
import { useToast } from '@/context/ToastContext';
import { TaskDropdown } from '@/components/TaskDropdown';

const RING_COLOR: Record<PomodoroPhase, string> = {
  work: 'var(--accent)',
  short_break: 'var(--green)',
  long_break: 'var(--amber)',
};

export default function PomodoroPage() {
  const pomo = usePomodoro();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [stats, setStats] = useState<PomodoroStats | null>(null);

  useEffect(() => {
    api
      .listTasks()
      .then((t) => setTasks(t.filter((x) => x.status !== 'done')))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .getPomodoroStats(todayIso())
      .then(setStats)
      .catch(() => undefined);
  }, [pomo.statsVersion]);

  const s = pomo.settings;
  const total = s ? phaseSeconds(pomo.phase, s) : 1;
  const pct = Math.round((1 - pomo.secondsLeft / total) * 100);
  const every = s?.long_break_interval ?? 4;
  const cycleNow = (pomo.cycleCount % every) + 1;

  async function save(patch: Parameters<typeof pomo.saveSettings>[0]) {
    try {
      await pomo.saveSettings(patch);
    } catch {
      toast('Не удалось сохранить настройки');
    }
  }

  if (!s) {
    return <p className="muted">Загрузка…</p>;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.3fr 1fr',
        gap: 14,
        alignItems: 'start',
      }}
    >
      {/* Таймер */}
      <div
        className="card"
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className="seg seg-flat" style={{ marginBottom: 22 }}>
          {(
            [
              ['work', 'Фокус'],
              ['short_break', 'Перерыв'],
              ['long_break', 'Длинный'],
            ] as [PomodoroPhase, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              className={pomo.phase === p ? 'on' : ''}
              onClick={() => pomo.switchPhase(p)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            width: 216,
            height: 216,
            borderRadius: '50%',
            background: `conic-gradient(${RING_COLOR[pomo.phase]} ${pct}%, var(--surface2) 0)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 196,
              height: 196,
              borderRadius: '50%',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span className="mono" style={{ fontSize: 44, fontWeight: 600 }}>
              {formatClock(pomo.secondsLeft)}
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
              {PHASE_LABEL[pomo.phase]} · цикл {cycleNow} из {every}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {pomo.running ? (
            <button
              className="btn"
              style={{ border: '1px solid var(--border2)', padding: '9px 26px' }}
              onClick={pomo.pause}
            >
              ❚❚ Пауза
            </button>
          ) : (
            <button
              className="btn btn-accent"
              style={{ padding: '9px 26px' }}
              onClick={pomo.start}
            >
              ▶ Старт
            </button>
          )}
          <button
            style={{
              background: 'transparent',
              color: 'var(--muted)',
              border: '1px solid var(--border2)',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onClick={pomo.reset}
          >
            ↺ Сброс
          </button>
        </div>

        <div style={{ width: 280 }}>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
            Задача для фокус-сессий
          </div>
          <TaskDropdown
            tasks={tasks}
            value={pomo.taskId}
            placeholder="Без задачи"
            onPick={pomo.setTaskId}
            small
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Статы дня */}
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Сегодня</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <div style={{ background: 'var(--surface2)', borderRadius: 9, padding: '10px 6px' }}>
              <div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>
                {stats?.completed_work_sessions ?? 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>сессий</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 9, padding: '10px 6px' }}>
              <div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>
                {formatHM(stats?.total_focus_seconds ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>фокус</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 9, padding: '10px 6px' }}>
              <div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>
                {formatHM(stats?.total_break_seconds ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>перерывы</div>
            </div>
          </div>
        </div>

        {/* Настройки */}
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Настройки</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(
              [
                ['Фокус, мин', 'work_minutes', 1, 180],
                ['Перерыв, мин', 'short_break_minutes', 1, 60],
                ['Длинный, мин', 'long_break_minutes', 1, 120],
                ['Длинный каждые', 'long_break_interval', 1, 12],
              ] as const
            ).map(([label, key, min, max]) => (
              <div key={key}>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
                  {label}
                </div>
                <input
                  type="number"
                  className="input input-sm"
                  min={min}
                  max={max}
                  defaultValue={s[key]}
                  onBlur={(e) => {
                    const v = Math.max(min, Math.min(max, Number(e.target.value) || min));
                    if (v !== s[key]) void save({ [key]: v });
                  }}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={s.auto_start}
              onChange={(e) => void save({ auto_start: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            Автостарт следующего интервала
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={s.track_to_timer}
              onChange={(e) => void save({ track_to_timer: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            Записывать фокус-сессии в трекер
          </label>
        </div>
      </div>
    </div>
  );
}
