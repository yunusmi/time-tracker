'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { ROLE_LABEL, useWorkspace } from '@/context/WorkspaceContext';
import { Avatar } from '@/components/Logo';
import { Skeleton } from '@/components/Skeleton';
import { CURRENCY_SYMBOL } from '@/lib/money';
import type { AbsenceKind, MemberSummary, PayKind } from '@/lib/types';

const ABSENCE_LABEL: Record<AbsenceKind, string> = {
  vacation: 'Отпуск',
  sick: 'Больничный',
};

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--red)',
  med: 'var(--amber)',
  low: 'var(--muted)',
};

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Профиль сотрудника (Команда → клик по имени, admin+): роль, отдел, оплата,
 * часы, открытые задачи, отпуска/больничные.
 */
export function MemberProfile({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const { isAdmin, departments, currency, money } = useWorkspace();

  const [data, setData] = useState<MemberSummary | null>(null);
  const [rate, setRate] = useState('');
  const [absFrom, setAbsFrom] = useState('');
  const [absTo, setAbsTo] = useState('');
  const [absKind, setAbsKind] = useState<AbsenceKind>('vacation');

  const load = useCallback(async () => {
    try {
      const summary = await api.memberSummary(userId);
      setData(summary);
      setRate(summary.pay_rate ? String(summary.pay_rate) : '');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось открыть профиль');
      onClose();
    }
  }, [userId, toast, onClose]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function patch(body: {
    department_id?: string | null;
    pay_kind?: PayKind;
    pay_rate?: number;
  }) {
    try {
      await api.updateMember(userId, body);
      await load();
      onChanged?.();
      toast('Профиль сохранён');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    }
  }

  async function addAbsence() {
    if (!absFrom || !absTo) {
      toast('Укажите даты «с» и «по»');
      return;
    }
    try {
      await api.createAbsence({
        user_id: userId,
        date_from: absFrom,
        date_to: absTo,
        kind: absKind,
      });
      setAbsFrom('');
      setAbsTo('');
      await load();
      onChanged?.();
      toast(`${ABSENCE_LABEL[absKind]} отмечен`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    }
  }

  async function removeAbsence(id: string) {
    await api.deleteAbsence(id).catch(() => undefined);
    await load();
    onChanged?.();
  }

  /** Дней в отсутствии, включительно. */
  function daysBetween(from: string, to: string): number {
    const ms =
      new Date(`${to}T00:00:00Z`).getTime() -
      new Date(`${from}T00:00:00Z`).getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 520, maxHeight: '76vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!data ? (
          <>
            <Skeleton height={22} width={180} style={{ marginBottom: 12 }} />
            <Skeleton height={70} style={{ marginBottom: 10 }} />
            <Skeleton height={120} />
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar name={data.name} src={data.avatar_url} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{data.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {data.email} · {ROLE_LABEL[data.role]}
                  {data.department_name ? ` · ${data.department_name}` : ''}
                </div>
              </div>
              <button className="icon-x" onClick={onClose} title="Закрыть">
                ✕
              </button>
            </div>

            {data.absence && (
              <div
                style={{
                  borderRadius: 9,
                  padding: '9px 12px',
                  marginBottom: 14,
                  background: 'var(--ysoft)',
                  color: 'var(--amber)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                {data.absence.kind === 'sick' ? 'На больничном' : 'В отпуске'} до{' '}
                {dateLabel(data.absence.date_to)} — норма за эти дни не
                начисляется
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div className="card" style={{ borderRadius: 10, padding: '11px 14px' }}>
                <div className="stat-title">Сегодня</div>
                <div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>
                  {data.today_seconds ? formatHM(data.today_seconds) : '—'}
                </div>
              </div>
              <div className="card" style={{ borderRadius: 10, padding: '11px 14px' }}>
                <div className="stat-title">За неделю</div>
                <div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>
                  {data.week_seconds ? formatHM(data.week_seconds) : '—'}
                </div>
              </div>
            </div>

            {isAdmin && (
              <>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  Оплата
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <div className="seg seg-flat">
                    <button
                      className={data.pay_kind === 'hourly' ? 'on' : ''}
                      style={{ padding: '6px 14px' }}
                      onClick={() => void patch({ pay_kind: 'hourly' })}
                    >
                      Почасовая
                    </button>
                    <button
                      className={data.pay_kind === 'salary' ? 'on' : ''}
                      style={{ padding: '6px 14px' }}
                      onClick={() => void patch({ pay_kind: 'salary' })}
                    >
                      Оклад
                    </button>
                  </div>
                  <input
                    className="input input-sm mono"
                    style={{ width: 120 }}
                    inputMode="decimal"
                    value={rate}
                    placeholder="0"
                    onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
                    onBlur={() => {
                      const value = Number(rate) || 0;
                      if (value !== data.pay_rate) void patch({ pay_rate: value });
                    }}
                  />
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                    {CURRENCY_SYMBOL[currency]}
                    {data.pay_kind === 'salary' ? '/мес' : '/ч'}
                  </span>
                </div>
                <div
                  style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 16 }}
                >
                  {data.pay_kind === 'salary'
                    ? `В часовую по норме: ${money(data.hourly_rate)}/ч. `
                    : ''}
                  Персональная ставка перекрывает ставку проекта в расчётах.
                </div>

                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  Отдел
                </div>
                <select
                  className="input input-sm"
                  style={{ width: '100%', marginBottom: 16 }}
                  value={data.department_id ?? ''}
                  onChange={(e) =>
                    void patch({ department_id: e.target.value || null })
                  }
                >
                  <option value="">Без отдела</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              Открытые задачи ({data.open_tasks.length})
            </div>
            <div style={{ marginBottom: 16 }}>
              {data.open_tasks.length === 0 && (
                <div className="muted" style={{ fontSize: '12.5px' }}>
                  Открытых задач нет
                </div>
              )}
              {data.open_tasks.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '12.5px',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: PRIORITY_COLOR[t.priority] ?? 'var(--muted)',
                      flexShrink: 0,
                    }}
                  />
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
                  {t.due_date && (
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>
                      до {dateLabel(t.due_date)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {isAdmin && (
              <>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  Отпуска и больничные
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: 10,
                  }}
                >
                  <input
                    type="date"
                    className="input input-sm"
                    value={absFrom}
                    onChange={(e) => setAbsFrom(e.target.value)}
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    —
                  </span>
                  <input
                    type="date"
                    className="input input-sm"
                    value={absTo}
                    onChange={(e) => setAbsTo(e.target.value)}
                  />
                  <div className="seg seg-flat">
                    <button
                      className={absKind === 'vacation' ? 'on' : ''}
                      style={{ padding: '6px 12px' }}
                      onClick={() => setAbsKind('vacation')}
                    >
                      Отпуск
                    </button>
                    <button
                      className={absKind === 'sick' ? 'on' : ''}
                      style={{ padding: '6px 12px' }}
                      onClick={() => setAbsKind('sick')}
                    >
                      Больничный
                    </button>
                  </div>
                  <button className="btn btn-outline" onClick={() => void addAbsence()}>
                    Отметить
                    {absFrom && absTo
                      ? ` · ${daysBetween(absFrom, absTo)} дн.`
                      : ''}
                  </button>
                </div>
                {data.absences.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '12.5px',
                    }}
                  >
                    <span className="chip-badge">{ABSENCE_LABEL[a.kind]}</span>
                    <span className="mono">
                      {dateLabel(a.date_from)} — {dateLabel(a.date_to)}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {daysBetween(a.date_from, a.date_to)} дн.
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      className="icon-x"
                      title="Снять"
                      onClick={() => void removeAbsence(a.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {data.absences.length === 0 && (
                  <div className="muted" style={{ fontSize: '12.5px' }}>
                    Отсутствий не отмечено
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
