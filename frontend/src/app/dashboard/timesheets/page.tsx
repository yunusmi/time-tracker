'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM, isoDaysAgo, todayIso } from '@/lib/format';
import type { DaySummary, TimesheetStatus, TimesheetsResponse } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Avatar } from '@/components/Logo';
import { SkeletonRows } from '@/components/Skeleton';

/** Частые причины возврата (чипы в форме «Вернуть…»). */
const RETURN_REASONS = [
  'Не хватает записей за один из дней',
  'Задачи без описания — непонятно, что делалось',
  'Слишком общие формулировки',
  'Время не соответствует задачам',
  'Есть лишние/дублирующие записи',
];

const STATUS_META: Record<TimesheetStatus, { label: string; bg: string; color: string }> = {
  draft: { label: 'Черновик', bg: 'var(--surface2)', color: 'var(--muted)' },
  pending: { label: 'На проверке', bg: 'var(--ysoft)', color: 'var(--amber)' },
  approved: { label: 'Утверждён', bg: 'var(--gsoft)', color: 'var(--green)' },
  returned: { label: 'Возвращён', bg: 'var(--rsoft)', color: 'var(--red)' },
};

function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('ru-RU', { month: 'short' })}`;
}

export default function TimesheetsPage() {
  const { toast } = useToast();
  const { isAdmin } = useWorkspace();
  const { settings } = useSettings();

  const [data, setData] = useState<TimesheetsResponse | null>(null);
  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Возврат таймшита: форма с чипами причин; без текста возврат не отправляется.
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [returnText, setReturnText] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [ts, s] = await Promise.all([
        api.listTimesheets(),
        api.entriesSummary(isoDaysAgo(6), todayIso()).catch(() => [] as DaySummary[]),
      ]);
      setData(ts);
      setSummary(s);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить таймшиты');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const goalDays = useMemo(() => {
    const goalSec = settings.daily_goal_hours * 3600;
    return summary.filter((d) => d.total_seconds >= goalSec).length;
  }, [summary, settings.daily_goal_hours]);

  async function submit() {
    try {
      await api.submitTimesheet();
      toast('Таймшит отправлен на проверку — сводка приложена');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось отправить');
    }
  }

  async function review(
    id: string | null,
    action: 'approve' | 'return',
    comment?: string,
  ) {
    if (!id) {
      toast('Сотрудник ещё не отправил таймшит');
      return;
    }
    if (action === 'return' && !comment?.trim()) {
      toast('Укажите причину возврата — без неё таймшит не возвращается');
      return;
    }
    try {
      await api.reviewTimesheet(id, action, comment);
      toast(action === 'approve' ? 'Таймшит утверждён' : 'Таймшит возвращён на доработку');
      setReturnFor(null);
      setReturnText('');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось обновить таймшит');
    }
  }

  async function approveAll() {
    try {
      const { approved } = await api.approveAllTimesheets();
      toast(`Утверждено таймшитов: ${approved}`);
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось утвердить');
    }
  }

  if (!data) {
    return error ? (
      <p className="error">{error}</p>
    ) : (
      <div className="card card-pad">
        <SkeletonRows rows={4} height={48} />
      </div>
    );
  }

  const mine = data.mine;
  const mineMeta = STATUS_META[mine.status];
  const canSubmit = mine.status === 'draft' || mine.status === 'returned';
  const pending = data.team.filter((t) => t.status === 'pending');

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {/* Моя неделя */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Моя неделя · {weekLabel(data.week_start)}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 2 }}>
              Итого {formatHM(mine.total_seconds)} · цель выполнена {goalDays} из 7 дней
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              padding: '3px 10px',
              background: mineMeta.bg,
              color: mineMeta.color,
            }}
          >
            {mineMeta.label}
          </span>
          {canSubmit && (
            <button
              className="btn btn-accent"
              style={{ padding: '8px 16px', fontSize: 13 }}
              onClick={() => void submit()}
            >
              Отправить на проверку
            </button>
          )}
        </div>
        {mine.summary && mine.status !== 'draft' && (
          <div
            style={{
              marginTop: 12,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--muted)' }}>
              Авто-сводка недели (приложена к таймшиту)
            </div>
            {mine.summary}
          </div>
        )}
        {mine.status === 'returned' && mine.comment && (
          <div
            style={{
              marginTop: 12,
              background: 'var(--rsoft)',
              border: '1px solid var(--red)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: '12.5px',
            }}
          >
            Комментарий админа: {mine.comment}
          </div>
        )}
      </div>

      {/* Таймшиты команды (admin+) */}
      {isAdmin && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Таймшиты команды</span>
            <div style={{ flex: 1 }} />
            {pending.length > 0 && (
              <button
                className="btn-green-soft"
                style={{ border: 'none', cursor: 'pointer', padding: '6px 14px' }}
                onClick={() => void approveAll()}
              >
                Утвердить все ({pending.length})
              </button>
            )}
          </div>
          {data.team.map((ts) => {
            const meta = STATUS_META[ts.status];
            return (
              <div key={ts.user_id}>
              <div className="list-row" style={{ padding: '11px 16px' }}>
                <Avatar name={ts.user_name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{ts.user_name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    {weekLabel(ts.week_start)} · {formatHM(ts.total_seconds)}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: '3px 10px',
                    background: meta.bg,
                    color: meta.color,
                  }}
                >
                  {meta.label}
                </span>
                {ts.summary && (
                  <button
                    className="btn-outline"
                    style={{ padding: '6px 12px' }}
                    title="Показать авто-сводку недели"
                    onClick={() =>
                      setExpandedId(expandedId === ts.user_id ? null : ts.user_id)
                    }
                  >
                    Сводка
                  </button>
                )}
                {ts.status === 'pending' && (
                  <>
                    <button
                      className="btn-green-soft"
                      style={{ border: 'none', cursor: 'pointer', padding: '6px 14px' }}
                      onClick={() => void review(ts.id, 'approve')}
                    >
                      Утвердить
                    </button>
                    <button
                      className="btn-outline"
                      style={{ padding: '6px 14px' }}
                      onClick={() => {
                        setReturnFor(returnFor === ts.user_id ? null : ts.user_id);
                        setReturnText('');
                      }}
                    >
                      Вернуть…
                    </button>
                  </>
                )}
              </div>
              {returnFor === ts.user_id && (
                <div
                  style={{
                    margin: '0 16px 12px',
                    border: '1px solid var(--red)',
                    background: 'var(--rsoft)',
                    borderRadius: 9,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    Причина возврата — обязательна
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {RETURN_REASONS.map((r) => (
                      <button
                        key={r}
                        className="chip"
                        onClick={() =>
                          setReturnText((prev) => (prev ? `${prev}. ${r}` : r))
                        }
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="input"
                    rows={2}
                    autoFocus
                    value={returnText}
                    placeholder="Что именно доработать — текст уйдёт сотруднику в письмо, уведомление и аудит"
                    onChange={(e) => setReturnText(e.target.value)}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setReturnFor(null);
                        setReturnText('');
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      className="btn btn-red"
                      disabled={!returnText.trim()}
                      onClick={() => void review(ts.id, 'return', returnText)}
                    >
                      Вернуть на доработку
                    </button>
                  </div>
                </div>
              )}
              {expandedId === ts.user_id && ts.summary && (
                <div
                  style={{
                    margin: '0 16px 11px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {ts.summary}
                </div>
              )}
              </div>
            );
          })}
          {data.team.length === 0 && (
            <div style={{ padding: '18px 16px', color: 'var(--muted)', fontSize: '12.5px' }}>
              В команде пока нет других участников.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
