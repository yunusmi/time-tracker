'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM, formatTime, isoDaysAgo, todayIso } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { entryProjectColor, NO_PROJECT_COLOR } from '@/lib/project';
import { entryTitle } from '@/components/Header';
import { openGenerator } from '@/components/ReportGenerator';
import type {
  DaySummary,
  InvoicePreview,
  ProjectWithStats,
  PublicReport as PublicReportType,
  ReportShare as ReportShareType,
  TimeEntry,
} from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const STREAK_WINDOW_DAYS = 60;

type RepView = 'chart' | 'cal';
type ExpPeriod = 'day' | 'week' | 'month';

/** Упрощённый отчёт по проекту для роли «Клиент» (read-only, без денег). */
function ClientReport() {
  const [report, setReport] = useState<PublicReportType | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .myProjectReport()
      .then(setReport)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить отчёт'),
      );
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p className="muted">Загрузка отчёта…</p>;

  const maxDay = Math.max(...report.days.map((d) => d.seconds), 1);
  const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  return (
    <div style={{ maxWidth: 720 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          fontSize: '12.5px',
          color: 'var(--muted)',
        }}
      >
        Отчёт по вашему проекту:
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text)',
            fontWeight: 600,
          }}
        >
          {report.project_color && (
            <span className="pdot" style={{ background: report.project_color }} />
          )}
          {report.project_name}
        </span>
        <span className="mono" style={{ fontSize: 12 }}>
          · {report.period.from} — {report.period.to}
        </span>
      </div>

      <div className="card" style={{ borderRadius: 10, padding: '13px 16px', marginBottom: 14 }}>
        <div className="stat-title">Итого за неделю</div>
        <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0' }}>
          {formatHM(report.total_seconds)}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>По дням</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
          {report.days.map((d) => (
            <div
              key={d.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <span className="mono" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                {d.seconds ? formatHM(d.seconds) : ''}
              </span>
              <div
                style={{
                  width: '100%',
                  borderRadius: '6px 6px 3px 3px',
                  background: 'var(--asoft)',
                  height: Math.round((d.seconds / maxDay) * 80),
                  minHeight: 3,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {dayNames[new Date(`${d.date}T00:00:00`).getDay()]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {report.tasks.length > 0 && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Задачи</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.tasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: '12.5px' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title}
                </span>
                <span className="mono" style={{ color: 'var(--muted)' }}>
                  {formatHM(t.seconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { settings } = useSettings();
  const { version } = useTimer();
  const { toast } = useToast();
  const { isAdmin, isClient, members } = useWorkspace();
  const { user } = useAuth();

  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [selDay, setSelDay] = useState(0); // смещение дней назад
  const [selEntries, setSelEntries] = useState<TimeEntry[]>([]);
  const [error, setError] = useState('');

  // Селектор участника (admin) — чей отчёт смотрим.
  const [repUserId, setRepUserId] = useState('');
  const targetUserId = repUserId || undefined;

  // График / календарь недели.
  const [repView, setRepView] = useState<RepView>('chart');
  const [calEntries, setCalEntries] = useState<TimeEntry[][]>([]);

  // Экспорт: период + проект.
  const [expPeriod, setExpPeriod] = useState<ExpPeriod>('day');
  const [expProjectId, setExpProjectId] = useState('');
  const [expMenuOpen, setExpMenuOpen] = useState(false);

  // Модалы: инвойс и публичная ссылка.
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [share, setShare] = useState<ReportShareType | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.entriesSummary(
          isoDaysAgo(STREAK_WINDOW_DAYS - 1),
          todayIso(),
          targetUserId,
        ),
        api.listProjects(true).catch(() => [] as ProjectWithStats[]),
      ]);
      setSummary(s);
      setProjects(p);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить отчёты');
    }
  }, [targetUserId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  useEffect(() => {
    api
      .listEntries(isoDaysAgo(selDay), targetUserId)
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
  }, [selDay, version, targetUserId]);

  // Календарь недели: записи каждого из 7 дней.
  useEffect(() => {
    if (repView !== 'cal') return;
    Promise.all(
      [6, 5, 4, 3, 2, 1, 0].map((off) =>
        api.listEntries(isoDaysAgo(off), targetUserId).catch(() => [] as TimeEntry[]),
      ),
    ).then(setCalEntries);
  }, [repView, targetUserId, version]);

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

  // По проектам и топ задач за неделю (+деньги: billable-часы × ставка, admin)
  const { projBreak, taskBreak, weekMoney } = useMemo(() => {
    const byProject = new Map<string | null, { seconds: number; billable: number }>();
    const byTask = new Map<string, { title: string; project_id: string | null; seconds: number }>();
    for (let off = 0; off < 7; off++) {
      const day = byDate.get(isoDaysAgo(off));
      if (!day) continue;
      for (const p of day.by_project) {
        const cur = byProject.get(p.project_id) ?? { seconds: 0, billable: 0 };
        cur.seconds += p.seconds;
        cur.billable += p.billable_seconds ?? p.seconds;
        byProject.set(p.project_id, cur);
      }
      for (const t of day.by_task) {
        const cur = byTask.get(t.task_id);
        if (cur) cur.seconds += t.seconds;
        else byTask.set(t.task_id, { title: t.task_title, project_id: t.project_id, seconds: t.seconds });
      }
    }
    const projOf = (projectId: string | null) =>
      projects.find((p) => p.id === projectId);
    const colorOf = (projectId: string | null) =>
      projOf(projectId)?.color ?? NO_PROJECT_COLOR;
    const nameOf = (projectId: string | null) =>
      projOf(projectId)?.name ?? 'Без проекта';

    let weekMoney = 0;
    const maxProj = Math.max(...[...byProject.values()].map((v) => v.seconds), 1);
    const projBreak = [...byProject.entries()]
      .map(([projectId, agg]) => {
        const rate = projOf(projectId)?.hourly_rate ?? 0;
        const money = (agg.billable / 3600) * rate;
        weekMoney += money;
        return {
          id: projectId ?? 'none',
          name: nameOf(projectId),
          color: colorOf(projectId),
          seconds: agg.seconds,
          money,
          pct: Math.round((agg.seconds / maxProj) * 100),
        };
      })
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

    return { projBreak, taskBreak, weekMoney };
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

  function expRange(): { from: string; to: string } {
    if (expPeriod === 'day') {
      const d = isoDaysAgo(selDay);
      return { from: d, to: d };
    }
    if (expPeriod === 'week') return { from: isoDaysAgo(6), to: todayIso() };
    return { from: isoDaysAgo(29), to: todayIso() };
  }

  async function exportXlsx() {
    const { from, to } = expRange();
    try {
      if (expPeriod === 'day' && !expProjectId) {
        await api.exportToday(from);
      } else {
        await api.exportReport(from, to, expProjectId || undefined);
      }
    } catch {
      toast('Не удалось сформировать отчёт');
    }
  }

  async function openInvoice() {
    try {
      const inv = await api.invoicePreview(
        isoDaysAgo(6),
        todayIso(),
        expProjectId || undefined,
      );
      setInvoice(inv);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сформировать счёт');
    }
  }

  async function openShare() {
    try {
      const s = await api.getOrCreateReportShare(expProjectId || null);
      setShare(s);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось создать ссылку');
    }
  }

  async function patchShare(
    patch: Partial<{ active: boolean; hide_money: boolean; hide_names: boolean }>,
  ) {
    if (!share) return;
    try {
      setShare(await api.updateReportShare(share.id, patch));
    } catch {
      toast('Не удалось сохранить настройки ссылки');
    }
  }

  /** «Скачать PDF»: чистое окно со счётом + диалог печати браузера. */
  function invoicePdf() {
    if (!invoice) return;
    const w = window.open('', '_blank', 'width=640,height=800');
    if (!w) return;
    const rows = invoice.rows
      .map(
        (r) =>
          `<tr><td>${r.task_title}</td><td style="text-align:right">${r.hours.toLocaleString('ru-RU')}</td><td style="text-align:right">${formatMoney(r.rate)}</td><td style="text-align:right;font-weight:600">${formatMoney(r.sum)}</td></tr>`,
      )
      .join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Счёт ${invoice.number}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;color:#191a1f}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px 10px;border-bottom:1px solid #e4e5ea;font-size:13px;text-align:left}tfoot td{font-weight:700;border-top:2px solid #191a1f}</style>
      </head><body>
      <h1>Счёт № ${invoice.number}</h1>
      <p>Период: ${invoice.period.from} — ${invoice.period.to} · Проект: ${invoice.project_name}</p>
      <table><thead><tr><th>Задача</th><th style="text-align:right">Часы</th><th style="text-align:right">Ставка</th><th style="text-align:right">Сумма</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">Итого</td><td style="text-align:right">${formatMoney(invoice.total)}</td></tr></tfoot></table>
      <script>window.print()</script></body></html>`);
    w.document.close();
  }

  // Клиент видит только отчёт своего проекта (read-only, без денег).
  if (isClient) {
    return <ClientReport />;
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {/* Селектор участника (admin) */}
      {isAdmin && members.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Участник:</span>
          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            const value = isMe ? '' : m.user_id;
            const selected = repUserId === value;
            return (
              <button
                key={m.user_id}
                onClick={() => setRepUserId(value)}
                style={{
                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected ? 'var(--asoft)' : 'var(--surface)',
                  color: selected ? 'var(--accent)' : 'var(--text)',
                  borderRadius: 99,
                  padding: '5px 14px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {isMe ? 'Вы' : m.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid-reports">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Бар-чарт / календарь 7 дней */}
          <div className="card card-pad">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>Последние 7 дней</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                итого {formatHM(weekSec)} · цель выполнена {goalDays} из 7 дней
              </span>
              <div style={{ flex: 1 }} />
              <div className="seg seg-flat" style={{ borderRadius: 7 }}>
                <button
                  className={repView === 'chart' ? 'on' : ''}
                  style={{ padding: '4px 12px', fontSize: '11.5px' }}
                  onClick={() => setRepView('chart')}
                >
                  График
                </button>
                <button
                  className={repView === 'cal' ? 'on' : ''}
                  style={{ padding: '4px 12px', fontSize: '11.5px' }}
                  onClick={() => setRepView('cal')}
                >
                  Календарь
                </button>
              </div>
            </div>
            {repView === 'chart' ? (
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
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6 }}>
                  {bars.map((b, i) => {
                    const dayEntries = calEntries[i] ?? [];
                    return (
                      <div key={b.off} style={{ flex: 1, minWidth: 0 }}>
                        <button
                          onClick={() => setSelDay(b.off)}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 11,
                            color: b.selected ? 'var(--accent)' : 'var(--muted)',
                            fontWeight: b.selected ? 700 : 400,
                            padding: '2px 0 6px',
                          }}
                        >
                          {b.label}
                        </button>
                        <div
                          style={{
                            position: 'relative',
                            height: 280,
                            background: 'var(--surface2)',
                            borderRadius: 6,
                            overflow: 'hidden',
                          }}
                        >
                          {dayEntries
                            .filter((e) => e.ended_at)
                            .map((e) => {
                              const d = new Date(e.started_at);
                              const m1 = d.getHours() * 60 + d.getMinutes();
                              const m2 = m1 + e.duration_seconds / 60;
                              const top = Math.max(0, ((m1 - 480) / 720) * 100);
                              const bot = Math.min(100, ((m2 - 480) / 720) * 100);
                              if (bot <= top) return null;
                              return (
                                <div
                                  key={e.id}
                                  title={`${entryTitle(e)} · ${formatTime(e.started_at)}–${e.ended_at ? formatTime(e.ended_at) : ''}`}
                                  style={{
                                    position: 'absolute',
                                    left: 2,
                                    right: 2,
                                    borderRadius: 3,
                                    background: entryProjectColor(e),
                                    opacity: 0.85,
                                    top: `${top.toFixed(1)}%`,
                                    height: `${Math.max(1.4, bot - top).toFixed(1)}%`,
                                  }}
                                />
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    color: 'var(--muted)',
                    marginTop: 6,
                  }}
                >
                  <span>08:00</span>
                  <span>14:00</span>
                  <span>20:00</span>
                </div>
              </>
            )}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>По проектам · неделя</span>
              {isAdmin && weekMoney > 0 && (
                <span className="mono" style={{ fontSize: '12.5px', color: 'var(--green)', fontWeight: 600 }}>
                  {formatMoney(weekMoney)}
                </span>
              )}
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
                      {isAdmin && p.money > 0 ? ` · ${formatMoney(p.money)}` : ''}
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
          <div className="card card-pad" style={{ overflow: 'visible' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Экспорт</div>
            <div className="seg seg-flat" style={{ display: 'flex', marginBottom: 8 }}>
              {(
                [
                  ['day', 'День'],
                  ['week', 'Неделя'],
                  ['month', 'Месяц'],
                ] as [ExpPeriod, string][]
              ).map(([p, label]) => (
                <button
                  key={p}
                  className={expPeriod === p ? 'on' : ''}
                  style={{ flex: 1, padding: '5px 0', fontSize: 12 }}
                  onClick={() => setExpPeriod(p)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="menu-wrap" style={{ marginBottom: 10 }}>
              <button
                className="dd-btn"
                style={{ borderRadius: 7, padding: '7px 10px', fontSize: '12.5px' }}
                onClick={() => setExpMenuOpen((o) => !o)}
              >
                {projects.find((p) => p.id === expProjectId)?.name ?? 'Все проекты'}
                <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
              </button>
              {expMenuOpen && (
                <div className="menu">
                  <div
                    className="menu-item"
                    style={{ fontSize: '12.5px' }}
                    onClick={() => {
                      setExpProjectId('');
                      setExpMenuOpen(false);
                    }}
                  >
                    Все проекты
                  </div>
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="menu-item"
                      style={{ fontSize: '12.5px' }}
                      onClick={() => {
                        setExpProjectId(p.id);
                        setExpMenuOpen(false);
                      }}
                    >
                      <span className="pdot" style={{ background: p.color }} />
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn-outline"
              style={{ width: '100%', padding: 8, fontSize: 13, fontWeight: 600 }}
              onClick={() => void exportXlsx()}
            >
              ↓ Скачать .xlsx
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => void openInvoice()}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    background: 'var(--asoft)',
                    border: '1px solid var(--accent)',
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                  }}
                >
                  Сформировать счёт
                </button>
                <button
                  className="btn-outline"
                  style={{ width: '100%', marginTop: 8, padding: 8, fontSize: 13, fontWeight: 600 }}
                  onClick={() =>
                    openGenerator({ mode: 'client', project_id: expProjectId || null })
                  }
                >
                  Отчёт для клиента (текст)
                </button>
                <button
                  className="btn-outline"
                  style={{ width: '100%', marginTop: 8, padding: 8, fontSize: 13, fontWeight: 600 }}
                  onClick={() => void openShare()}
                >
                  Поделиться отчётом
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Модал: превью счёта */}
      {invoice && (
        <div
          onClick={() => setInvoice(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.55)',
            zIndex: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560,
              maxHeight: '82vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 12,
              boxShadow: 'var(--shadow)',
              padding: '22px 24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16 }}>Счёт № {invoice.number}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                {invoice.period.from} — {invoice.period.to}
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 14 }}>
              Проект: {invoice.project_name} · оплачиваемые часы × ставка
            </div>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 9,
                overflow: 'hidden',
                marginBottom: 14,
              }}
            >
              <div
                className="stat-title"
                style={{
                  display: 'flex',
                  padding: '8px 12px',
                  background: 'var(--surface2)',
                }}
              >
                <span style={{ flex: 1 }}>Задача</span>
                <span style={{ width: 56, textAlign: 'right' }}>Часы</span>
                <span style={{ width: 88, textAlign: 'right' }}>Ставка</span>
                <span style={{ width: 100, textAlign: 'right' }}>Сумма</span>
              </div>
              {invoice.rows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    padding: '9px 12px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '12.5px',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.task_title}
                  </span>
                  <span className="mono" style={{ width: 56, textAlign: 'right' }}>
                    {r.hours.toLocaleString('ru-RU')}
                  </span>
                  <span className="mono" style={{ width: 88, textAlign: 'right', color: 'var(--muted)' }}>
                    {formatMoney(r.rate)}
                  </span>
                  <span className="mono" style={{ width: 100, textAlign: 'right', fontWeight: 600 }}>
                    {formatMoney(r.sum)}
                  </span>
                </div>
              ))}
              {invoice.rows.length === 0 && (
                <div style={{ padding: '16px 12px', fontSize: '12.5px', color: 'var(--muted)' }}>
                  За период нет оплачиваемых записей по задачам проекта.
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderTop: '1px solid var(--border2)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <span>Итого</span>
                <span className="mono" style={{ color: 'var(--green)' }}>
                  {formatMoney(invoice.total)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-outline" style={{ padding: '8px 16px' }} onClick={() => setInvoice(null)}>
                Закрыть
              </button>
              <button
                className="btn btn-accent"
                style={{ borderRadius: 7, padding: '8px 18px', fontSize: '12.5px' }}
                onClick={invoicePdf}
              >
                Скачать PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: публичная ссылка */}
      {share && (
        <div
          onClick={() => setShare(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.55)',
            zIndex: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 12,
              boxShadow: 'var(--shadow)',
              padding: '22px 24px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Публичная ссылка на отчёт
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 14 }}>
              Получатель увидит отчёт «
              {projects.find((p) => p.id === share.project_id)?.name ?? 'Все проекты'}
              » без доступа к остальным данным.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <span
                className="mono"
                style={{
                  flex: 1,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  padding: '8px 10px',
                  fontSize: 12,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${share.token}`}
              </span>
              <button
                className="btn btn-accent"
                style={{ borderRadius: 7, padding: '8px 14px', fontSize: '12.5px' }}
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${window.location.origin}/r/${share.token}`,
                  );
                  toast('Ссылка скопирована');
                }}
              >
                Копировать
              </button>
            </div>
            {(
              [
                ['active', 'Ссылка активна'],
                ['hide_money', 'Скрыть суммы'],
                ['hide_names', 'Скрыть имена сотрудников'],
              ] as ['active' | 'hide_money' | 'hide_names', string][]
            ).map(([key, label]) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={share[key]}
                  onChange={(e) => void patchShare({ [key]: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                {label}
              </label>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn-outline" style={{ padding: '8px 16px' }} onClick={() => setShare(null)}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
