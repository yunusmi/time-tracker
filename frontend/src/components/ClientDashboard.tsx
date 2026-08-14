'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Skeleton, SkeletonRows } from '@/components/Skeleton';
import type {
  ClientDashboard as ClientDashboardType,
  MilestoneStatus,
  PublicReport,
  ReportCommentView,
} from '@/lib/types';

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const MS_META: Record<MilestoneStatus, { label: string; color: string }> = {
  plan: { label: 'план', color: 'var(--muted)' },
  in_progress: { label: 'в работе', color: 'var(--amber)' },
  done: { label: 'готово', color: 'var(--green)' },
};

function dateLabel(iso: string | null): string {
  if (!iso) return 'без срока';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Клиентский дашборд в «Отчётах»: часы по дням и задачи, «Бюджет этапа»,
 * «Вехи проекта», «Лента недели» и тред вопросов к менеджеру.
 */
export function ClientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [report, setReport] = useState<PublicReport | null>(null);
  const [dash, setDash] = useState<ClientDashboardType | null>(null);
  const [comments, setComments] = useState<ReportCommentView[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const loadComments = useCallback(async () => {
    try {
      setComments(await api.listReportComments());
    } catch {
      setComments([]);
    }
  }, []);

  useEffect(() => {
    api
      .myProjectReport()
      .then(setReport)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : 'Не удалось загрузить отчёт',
        ),
      );
    api
      .clientDashboard()
      .then(setDash)
      .catch(() => setDash(null));
    void loadComments();
  }, [loadComments]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      const created = await api.addReportComment(body);
      setComments((prev) => [...(prev ?? []), created]);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось отправить');
      setDraft(body);
    }
  }

  if (error) return <p className="error">{error}</p>;

  if (!report) {
    return (
      <div style={{ maxWidth: 720 }}>
        <Skeleton height={18} width={260} style={{ marginBottom: 14 }} />
        <Skeleton height={70} radius={10} style={{ marginBottom: 14 }} />
        <Skeleton height={180} radius={12} />
      </div>
    );
  }

  const maxDay = Math.max(...report.days.map((d) => d.seconds), 1);
  const budget = dash?.budget;
  const budgetPct =
    budget && budget.budget_hours
      ? Math.min(100, Math.round((budget.used_hours / budget.budget_hours) * 100))
      : 0;

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
          flexWrap: 'wrap',
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
        <span className="chip-badge">только просмотр</span>
      </div>

      <div className="grid-stats" style={{ marginBottom: 14 }}>
        <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
          <div className="stat-title">Итого за неделю</div>
          <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0' }}>
            {formatHM(report.total_seconds)}
          </div>
        </div>
        <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
          <div className="stat-title">Задач в работе</div>
          <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0' }}>
            {report.tasks_in_progress}
          </div>
        </div>
        <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
          <div className="stat-title">Готово за неделю</div>
          <div
            className="mono"
            style={{ fontSize: 21, fontWeight: 600, margin: '3px 0', color: 'var(--green)' }}
          >
            {report.tasks_done}
          </div>
        </div>
      </div>

      {/* Бюджет этапа: часы из лимита и прогноз даты (без денег). */}
      {budget && budget.budget_hours > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Бюджет этапа
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 10 }}>
            {budget.used_hours}ч из {budget.budget_hours}ч
            {budget.forecast_date
              ? ` · при текущем темпе (${budget.week_hours}ч/нед) завершение около ${dateLabel(budget.forecast_date)}`
              : ''}
          </div>
          <div className="progress" style={{ height: 6 }}>
            <div
              style={{
                width: `${budgetPct}%`,
                background:
                  budgetPct > 100
                    ? 'var(--red)'
                    : budgetPct > 80
                      ? 'var(--amber)'
                      : 'var(--green)',
              }}
            />
          </div>
        </div>
      )}

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
                  background: report.project_color ?? 'var(--asoft)',
                  height: Math.round((d.seconds / maxDay) * 80),
                  minHeight: 3,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {DAY_NAMES[new Date(`${d.date}T00:00:00`).getDay()]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Вехи проекта: таймлайн готово / в работе / план. */}
      {dash && dash.milestones.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
            Вехи проекта
          </div>
          {dash.milestones.map((m) => (
            <div key={m.id} className="ms-row">
              <span className={`ms-dot ${m.status}`} style={{ cursor: 'default' }} />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  textDecoration: m.status === 'done' ? 'line-through' : 'none',
                  color: m.status === 'done' ? 'var(--muted)' : 'var(--text)',
                }}
              >
                {m.title}
              </span>
              <span style={{ fontSize: 11.5, color: MS_META[m.status].color }}>
                {MS_META[m.status].label}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {dateLabel(m.due_date)}
              </span>
            </div>
          ))}
        </div>
      )}

      {report.tasks.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Задачи</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.tasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: '12.5px' }}>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
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

      {/* Лента недели: события по проекту из журнала действий. */}
      {dash && dash.feed.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
            Лента недели
          </div>
          {dash.feed.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '7px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '12.5px',
              }}
            >
              <span className="mono" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                {new Date(e.created_at).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              <span style={{ flex: 1 }}>{e.action}</span>
            </div>
          ))}
        </div>
      )}

      {/* Вопросы по отчёту: тред клиент ↔ менеджер. */}
      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Вопросы по отчёту
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Менеджер получит уведомление и ответит здесь же.
        </div>
        {comments === null ? (
          <SkeletonRows rows={2} height={34} />
        ) : (
          comments.map((c) => {
            const mine = c.author_id === user?.id;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: mine ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    background: mine ? 'var(--asoft)' : 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    lineHeight: 1.55,
                  }}
                >
                  {c.body}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  {mine ? 'вы' : c.author_name} ·{' '}
                  {new Date(c.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            className="input input-sm"
            style={{ flex: 1 }}
            placeholder="Например: почему в среду меньше часов?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
          />
          <button className="btn btn-accent" onClick={() => void send()}>
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}
