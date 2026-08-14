'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Logo } from '@/components/Logo';
import type { PublicReport } from '@/lib/types';

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «Неделя 7–13 августа 2026» — формат периода из макета. */
function weekLabel(from: string, to: string): string {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const month = end.toLocaleDateString('ru-RU', { month: 'long' });
  const sameMonth = start.getMonth() === end.getMonth();
  const startPart = sameMonth
    ? String(start.getDate())
    : `${start.getDate()} ${start.toLocaleDateString('ru-RU', { month: 'long' })}`;
  return `Неделя ${startPart}–${end.getDate()} ${month} ${end.getFullYear()}`;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  done: { label: 'Готово', bg: '#e6f7f0', color: '#0e9f6e' },
  in_progress: { label: 'В работе', bg: '#fef3e2', color: '#b45309' },
  todo: { label: 'К работе', bg: '#f0f0f3', color: '#6b6e78' },
};

/**
 * Публичный read-only отчёт по токен-ссылке (без авторизации).
 * Светлая тема и вёрстка — по макету Public Report.dc.html.
 */
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

  // Страница «ссылка отозвана» (Auth Flows.dc.html): объяснение + запрос новой.
  if (error) {
    return (
      <div className="public-page">
        <div className="public-wrap" style={{ maxWidth: 480, paddingTop: 80 }}>
          <div className="public-card" style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: '#fdecec',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                margin: '0 auto 16px',
              }}
            >
              ✕
            </div>
            <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Ссылка недоступна</h1>
            <p style={{ fontSize: '13.5px', color: '#6b6e78', lineHeight: 1.6 }}>
              {error}. Владелец отчёта мог отключить публичный доступ — попросите
              прислать новую ссылку.
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-block',
                marginTop: 18,
                background: '#6366f1',
                color: '#fff',
                borderRadius: 9,
                padding: '11px 24px',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Войти в Хронос
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="public-page">
        <div className="public-wrap">
          <div className="public-card">
            <div className="sk" style={{ width: 200, height: 22, marginBottom: 10 }} />
            <div className="sk" style={{ width: 280, height: 14, marginBottom: 24 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <div className="sk" style={{ height: 70 }} />
              <div className="sk" style={{ height: 70 }} />
              <div className="sk" style={{ height: 70 }} />
            </div>
            <div className="sk" style={{ height: 130, marginTop: 22 }} />
          </div>
        </div>
      </div>
    );
  }

  const maxDay = Math.max(...report.days.map((d) => d.seconds), 1);
  const periodLabel = weekLabel(report.period.from, report.period.to);
  const accent = report.project_color ?? report.brand_color ?? '#6366f1';

  return (
    <div className="public-page">
      <div className="public-wrap">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 22,
            flexWrap: 'wrap',
          }}
        >
          {report.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.logo_url}
              alt={report.workspace_name}
              style={{ width: 24, height: 24, borderRadius: 7, objectFit: 'cover' }}
            />
          ) : (
            <Logo size={24} color={report.brand_color ?? '#6366f1'} />
          )}
          <span style={{ fontWeight: 700, fontSize: 15 }}>Хронос</span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              background: '#e8e9f8',
              color: '#6366f1',
              borderRadius: 6,
              padding: '3px 10px',
            }}
          >
            ПУБЛИЧНЫЙ ОТЧЁТ · ТОЛЬКО ПРОСМОТР
          </span>
        </div>

        <div className="public-card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 21,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: accent,
                }}
              />
              {report.project_name}
            </span>
            <span style={{ fontSize: 13, color: '#6b6e78' }}>
              {report.workspace_name}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#6b6e78', marginBottom: 22 }}>
            {periodLabel} · отчёт обновляется автоматически
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${report.money !== null ? 4 : 3}, 1fr)`,
              gap: 12,
              marginBottom: 26,
            }}
          >
            <PublicStat title="Всего часов" value={formatHM(report.total_seconds)} />
            <PublicStat title="Задач в работе" value={String(report.tasks_in_progress)} />
            <PublicStat
              title="Готово за неделю"
              value={String(report.tasks_done)}
              color="#10b981"
            />
            {report.money !== null && (
              <PublicStat
                title="Сумма"
                value={formatMoney(report.money, report.currency)}
                color="#0e9f6e"
              />
            )}
          </div>

          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
            Часы по дням
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              height: 120,
              marginBottom: 6,
            }}
          >
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
                <span className="mono" style={{ fontSize: '10.5px', color: '#8b8f9a' }}>
                  {d.seconds ? formatHM(d.seconds) : '—'}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 44,
                    borderRadius: '6px 6px 3px 3px',
                    background: d.seconds ? accent : '#eceded',
                    height: `${Math.max(3, Math.round((d.seconds / maxDay) * 100))}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
            {report.days.map((d) => (
              <div
                key={d.date}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#8b8f9a',
                }}
              >
                {DAY_NAMES[new Date(`${d.date}T00:00:00`).getDay()]}
              </div>
            ))}
          </div>

          {report.tasks.length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                Над чем работали
              </div>
              {report.tasks.map((t, i) => {
                const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.todo;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 0',
                      borderBottom: '1px solid #eceded',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        padding: '3px 10px',
                        background: badge.bg,
                        color: badge.color,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {badge.label}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: '13.5px',
                        fontWeight: 500,
                        minWidth: 0,
                      }}
                    >
                      {t.title}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: '12.5px', color: '#6b6e78', flexShrink: 0 }}
                    >
                      {formatHM(t.seconds)}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {report.members.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                Участники
              </div>
              {report.members.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid #eceded',
                    fontSize: '13.5px',
                  }}
                >
                  <span style={{ flex: 1 }}>{m.name}</span>
                  <span className="mono" style={{ fontSize: '12.5px', color: '#6b6e78' }}>
                    {formatHM(m.seconds)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {(report.money === null || report.members.length === 0) && (
            <div style={{ fontSize: '11.5px', color: '#8b8f9a', marginTop: 14 }}>
              {report.money === null && report.members.length === 0
                ? 'Суммы и имена сотрудников скрыты настройками этой ссылки.'
                : report.money === null
                  ? 'Суммы скрыты настройками этой ссылки.'
                  : 'Имена сотрудников скрыты настройками этой ссылки.'}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#8b8f9a' }}>
          Сформировано в Хроносе · доступ может быть отозван владельцем
        </div>
      </div>
    </div>
  );
}

function PublicStat({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ background: '#f7f7fa', borderRadius: 11, padding: '14px 16px' }}>
      <div
        style={{
          fontSize: 11,
          color: '#8b8f9a',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
        }}
      >
        {title}
      </div>
      <div
        className="mono"
        style={{ fontSize: 23, fontWeight: 600, marginTop: 3, color }}
      >
        {value}
      </div>
    </div>
  );
}
