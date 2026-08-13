'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import type { PublicReport } from '@/lib/types';

/** Публичный read-only отчёт по токен-ссылке (без авторизации). */
export default function PublicReportPage({
  params,
}: {
  params: { token: string };
}) {
  const [report, setReport] = useState<PublicReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .publicReport(params.token)
      .then(setReport)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : 'Не удалось загрузить отчёт',
        ),
      );
  }, [params.token]);

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1>Отчёт недоступен</h1>
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="auth-wrap">
        <p className="muted">Загрузка отчёта…</p>
      </div>
    );
  }

  const maxDay = Math.max(...report.days.map((d) => d.seconds), 1);
  const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #fff' }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Хронос · отчёт</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>
          {report.project_color && (
            <span
              className="pdot"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: report.project_color,
                marginRight: 8,
              }}
            />
          )}
          {report.project_name}
        </h1>
        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
          {report.period.from} — {report.period.to}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: report.money !== null ? '1fr 1fr' : '1fr',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
          <div className="stat-title">Итого за неделю</div>
          <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0' }}>
            {formatHM(report.total_seconds)}
          </div>
        </div>
        {report.money !== null && (
          <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
            <div className="stat-title">Сумма (billable × ставка)</div>
            <div
              className="mono"
              style={{ fontSize: 21, fontWeight: 600, margin: '3px 0', color: 'var(--green)' }}
            >
              {formatMoney(report.money)}
            </div>
          </div>
        )}
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
        <div className="card card-pad" style={{ marginBottom: 14 }}>
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

      {report.members.length > 0 && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Участники</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.members.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: '12.5px' }}>
                <span style={{ flex: 1 }}>{m.name}</span>
                <span className="mono" style={{ color: 'var(--muted)' }}>
                  {formatHM(m.seconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
