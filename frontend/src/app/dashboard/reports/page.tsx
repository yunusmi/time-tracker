'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM, formatTime, isoDaysAgo, todayIso } from '@/lib/format';
import { entryProjectColor, NO_PROJECT_COLOR } from '@/lib/project';
import { entryTitle } from '@/components/Header';
import type { DaySummary, ProjectWithStats, TimeEntry } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const STREAK_WINDOW_DAYS = 60;

export default function ReportsPage() {
  const { settings } = useSettings();
  const { version } = useTimer();
  const { toast } = useToast();

  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [selDay, setSelDay] = useState(0); // смещение дней назад
  const [selEntries, setSelEntries] = useState<TimeEntry[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.entriesSummary(isoDaysAgo(STREAK_WINDOW_DAYS - 1), todayIso()),
        api.listProjects(true).catch(() => [] as ProjectWithStats[]),
      ]);
      setSummary(s);
      setProjects(p);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить отчёты');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  useEffect(() => {
    api
      .listEntries(isoDaysAgo(selDay))
      .then((e) =>
        setSelEntries(
          e
            .filter((x) => x.ended_at)
            .sort(
              (a, b) =>
                new Date(a.started_at).getTime() -
                new Date(b.started_at).getTime(),
            ),
        ),
      )
      .catch(() => setSelEntries([]));
  }, [selDay, version]);

  const byDate = useMemo(() => {
    const m = new Map<string, DaySummary>();
    for (const d of summary) m.set(d.date, d);
    return m;
  }, [summary]);

  const goalSec = settings.daily_goal_hours * 3600;
  const daySec = (off: number) => byDate.get(isoDaysAgo(off))?.total_seconds ?? 0;

  // Бар-чарт за 7 дней
  const weekSec = [0, 1, 2, 3, 4, 5, 6].reduce((s, off) => s + daySec(off), 0);
  const goalDays = [0, 1, 2, 3, 4, 5, 6].filter((off) => daySec(off) >= goalSec).length;
  const maxDay = Math.max(...[0, 1, 2, 3, 4, 5, 6].map(daySec), 1);
  const bars = [6, 5, 4, 3, 2, 1, 0].map((off) => {
    const total = daySec(off);
    const d = new Date(Date.now() - off * 86_400_000);
    return {
      off,
      total,
      hLabel: total ? `${(total / 3600).toFixed(1).replace('.', ',')}ч` : '',
      heightPx: Math.round((total / maxDay) * 108),
      label: off === 0 ? 'сегодня' : DAY_NAMES[d.getDay()],
      selected: selDay === off,
    };
  });

  // Streak: подряд дней с выполненной целью (сегодня не рвёт серию, если ещё не добита)
  const streak = useMemo(() => {
    let count = 0;
    let off = daySec(0) >= goalSec ? 0 : 1;
    while (off < STREAK_WINDOW_DAYS && daySec(off) >= goalSec) {
      count++;
      off++;
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate, goalSec]);

  // Heatmap 14 дней
  const heat = useMemo(() => {
    const cells: { key: number; bg: string; tip: string }[] = [];
    for (let off = 13; off >= 0; off--) {
      const total = daySec(off);
      const r = Math.min(1, total / goalSec);
      const bg =
        total === 0
          ? 'var(--surface2)'
          : r >= 1
            ? 'var(--accent)'
            : `color-mix(in srgb, var(--accent) ${Math.max(18, Math.round(r * 70))}%, var(--surface2))`;
      const tip =
        new Date(Date.now() - off * 86_400_000).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
        }) + ` · ${formatHM(total)}`;
      cells.push({ key: off, bg, tip });
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate, goalSec]);

  // По проектам и топ задач за неделю
  const { projBreak, taskBreak } = useMemo(() => {
    const byProject = new Map<string | null, number>();
    const byTask = new Map<string, { title: string; project_id: string | null; seconds: number }>();
    for (let off = 0; off < 7; off++) {
      const day = byDate.get(isoDaysAgo(off));
      if (!day) continue;
      for (const p of day.by_project) {
        byProject.set(p.project_id, (byProject.get(p.project_id) ?? 0) + p.seconds);
      }
      for (const t of day.by_task) {
        const cur = byTask.get(t.task_id);
        if (cur) cur.seconds += t.seconds;
        else byTask.set(t.task_id, { title: t.task_title, project_id: t.project_id, seconds: t.seconds });
      }
    }
    const colorOf = (projectId: string | null) =>
      projects.find((p) => p.id === projectId)?.color ?? NO_PROJECT_COLOR;
    const nameOf = (projectId: string | null) =>
      projects.find((p) => p.id === projectId)?.name ?? 'Без проекта';

    const maxProj = Math.max(...byProject.values(), 1);
    const projBreak = [...byProject.entries()]
      .map(([projectId, seconds]) => ({
        id: projectId ?? 'none',
        name: nameOf(projectId),
        color: colorOf(projectId),
        seconds,
        pct: Math.round((seconds / maxProj) * 100),
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const taskBreak = [...byTask.entries()]
      .sort((a, b) => b[1].seconds - a[1].seconds)
      .slice(0, 5)
      .map(([id, t]) => ({
        id,
        title: t.title,
        color: colorOf(t.project_id),
        seconds: t.seconds,
      }));

    return { projBreak, taskBreak };
  }, [byDate, projects]);

  const selDate = new Date(Date.now() - selDay * 86_400_000);
  const selLabel = (() => {
    if (selDay === 0) return 'Сегодня';
    const s = selDate.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  async function exportXlsx() {
    try {
      await api.exportToday(isoDaysAgo(selDay));
    } catch {
      toast('Не удалось сформировать отчёт');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Бар-чарт 7 дней */}
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Последние 7 дней</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                итого {formatHM(weekSec)} · цель выполнена {goalDays} из 7 дней
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
              {bars.map((b) => (
                <button
                  key={b.off}
                  onClick={() => setSelDay(b.off)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span className="mono" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                    {b.hLabel}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      borderRadius: '6px 6px 3px 3px',
                      background: b.selected ? 'var(--accent)' : 'var(--asoft)',
                      height: b.heightPx,
                      minHeight: 3,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: b.selected ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: b.selected ? 700 : 400,
                    }}
                  >
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Записи выбранного дня */}
          <div className="card">
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>{selLabel}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>итого</span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {formatHM(daySec(selDay))}
              </span>
            </div>
            {selEntries.map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 16px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', width: 88, flexShrink: 0 }}>
                  {formatTime(e.started_at)}–{e.ended_at ? formatTime(e.ended_at) : '…'}
                </span>
                <span className="pdot" style={{ background: entryProjectColor(e) }} />
                <span
                  style={{
                    flex: 1,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entryTitle(e)}
                </span>
                <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {formatHM(e.duration_seconds)}
                </span>
              </div>
            ))}
            {selEntries.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12.5px' }}>
                В этот день время не трекалось.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Серия целей */}
          <div className="card card-pad">
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>Серия целей</span>
              <span className="mono" style={{ fontSize: 19, fontWeight: 600, color: 'var(--accent)' }}>
                {streak} дн.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {heat.map((h) => (
                <div
                  key={h.key}
                  title={h.tip}
                  style={{ flex: 1, height: 22, borderRadius: 4, background: h.bg }}
                />
              ))}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 6 }}>
              Последние 14 дней · цель {settings.daily_goal_hours}ч в день
            </div>
          </div>

          {/* По проектам */}
          <div className="card card-pad">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
              По проектам · неделя
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {projBreak.map((p) => (
                <div key={p.id}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12.5px',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span className="pdot" style={{ background: p.color }} />
                      {p.name}
                    </span>
                    <span className="mono" style={{ color: 'var(--muted)' }}>
                      {formatHM(p.seconds)}
                    </span>
                  </div>
                  <div className="progress">
                    <div style={{ background: p.color, width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
              {projBreak.length === 0 && (
                <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  За неделю пока нет данных.
                </div>
              )}
            </div>
          </div>

          {/* Топ задач */}
          <div className="card card-pad">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
              Топ задач · неделя
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {taskBreak.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '12.5px' }}>
                  <span className="pdot" style={{ background: t.color }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>
                    {formatHM(t.seconds)}
                  </span>
                </div>
              ))}
              {taskBreak.length === 0 && (
                <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  За неделю пока нет данных.
                </div>
              )}
            </div>
          </div>

          {/* Экспорт */}
          <div className="card card-pad">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Экспорт</div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 10 }}>
              Excel-отчёт за выбранный день: задачи, записи, сводка.
            </div>
            <button
              className="btn-outline"
              style={{ width: '100%', padding: 8, fontSize: 13, fontWeight: 600 }}
              onClick={() => void exportXlsx()}
            >
              ↓ Скачать .xlsx
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
