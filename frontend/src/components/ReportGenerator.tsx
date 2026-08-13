'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { GeneratorMode } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';

const TITLES: Record<GeneratorMode, string> = {
  standup: 'Стендап-отчёт',
  client: 'Отчёт для клиента',
  team: 'Сводка команды за вчера',
  notes: 'Release notes',
};

export interface OpenGeneratorDetail {
  mode: GeneratorMode;
  project_id?: string | null;
}

/** Открыть генератор из любого экрана. */
export function openGenerator(detail: OpenGeneratorDetail): void {
  window.dispatchEvent(new CustomEvent('tt-open-generator', { detail }));
}

/**
 * Генератор текстов (стендап и другие отчёты): модальный оверлей 560px,
 * редактируемый текст, копирование и отправка в Slack/Telegram.
 */
export function ReportGenerator() {
  const { settings } = useSettings();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GeneratorMode>('standup');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'ys' | 'st'>('ys');
  const [includeMisc, setIncludeMisc] = useState(true);
  const [aiSum, setAiSum] = useState(false);
  const [hoursLimit, setHoursLimit] = useState(80);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  // Ручные правки не затираем фоновыми ответами устаревших запросов.
  const reqId = useRef(0);

  const regenerate = useCallback(
    (params: {
      mode: GeneratorMode;
      project_id: string | null;
      direction: 'ys' | 'st';
      include_misc: boolean;
      ai_summary: boolean;
      hours_limit: number;
    }) => {
      const id = ++reqId.current;
      setLoading(true);
      api
        .generateReport({
          mode: params.mode,
          direction: params.direction,
          include_misc: params.include_misc,
          ai_summary: params.ai_summary,
          hours_limit: params.hours_limit,
          project_id: params.project_id,
        })
        .then((r) => {
          if (reqId.current === id) setText(r.text);
        })
        .catch(() => {
          if (reqId.current === id) toast('Не удалось сгенерировать текст');
        })
        .finally(() => {
          if (reqId.current === id) setLoading(false);
        });
    },
    [toast],
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenGeneratorDetail>).detail;
      const limit = settings.monthly_hours_limit || 80;
      setMode(detail.mode);
      setProjectId(detail.project_id ?? null);
      setDirection('ys');
      setIncludeMisc(true);
      setAiSum(false);
      setHoursLimit(limit);
      setText('');
      setOpen(true);
      regenerate({
        mode: detail.mode,
        project_id: detail.project_id ?? null,
        direction: 'ys',
        include_misc: true,
        ai_summary: false,
        hours_limit: limit,
      });
    };
    window.addEventListener('tt-open-generator', onOpen);
    return () => window.removeEventListener('tt-open-generator', onOpen);
  }, [regenerate, settings.monthly_hours_limit]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const change = (
    patch: Partial<{
      direction: 'ys' | 'st';
      include_misc: boolean;
      ai_summary: boolean;
      hours_limit: number;
    }>,
  ) => {
    const next = {
      mode,
      project_id: projectId,
      direction: patch.direction ?? direction,
      include_misc: patch.include_misc ?? includeMisc,
      ai_summary: patch.ai_summary ?? aiSum,
      hours_limit: patch.hours_limit ?? hoursLimit,
    };
    if (patch.direction !== undefined) setDirection(patch.direction);
    if (patch.include_misc !== undefined) setIncludeMisc(patch.include_misc);
    if (patch.ai_summary !== undefined) setAiSum(patch.ai_summary);
    if (patch.hours_limit !== undefined) setHoursLimit(patch.hours_limit);
    regenerate(next);
  };

  const integrations = (() => {
    try {
      return JSON.parse(
        window.localStorage.getItem('tt_integrations') ?? '{}',
      ) as Record<string, boolean>;
    } catch {
      return {} as Record<string, boolean>;
    }
  })();

  const send = (kind: 'slack' | 'tg') => {
    if (!integrations[kind]) {
      toast(
        `Подключите ${kind === 'slack' ? 'Slack' : 'Telegram'} в Настройках → Интеграции`,
      );
      return;
    }
    setOpen(false);
    // Реальная доставка через вебхук на BE; без настройки — демо-режим.
    api
      .sendReport(kind, text)
      .then(({ sent }) =>
        toast(
          kind === 'slack'
            ? `Отправлено в Slack #standup${sent ? '' : ' (демо)'}`
            : `Отправлено в Telegram${sent ? '' : ' (демо)'}`,
        ),
      )
      .catch(() => toast('Не удалось отправить'));
  };

  const copy = () => {
    if (navigator.clipboard) void navigator.clipboard.writeText(text);
    toast('Текст скопирован — вставьте в чат');
  };

  // Активный пункт сегмента — asoft/accent (как seg() в прототипе).
  const seg = (active: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? 'var(--asoft)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--muted)',
  });

  return (
    <div
      onClick={() => setOpen(false)}
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
          maxWidth: '100%',
          maxHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 12,
          boxShadow: 'var(--shadow)',
          padding: '20px 22px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          {TITLES[mode]}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Сгенерировано из данных трекера — текст можно отредактировать перед
          отправкой.
        </div>
        {mode === 'standup' && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                background: 'var(--surface2)',
                borderRadius: 8,
                padding: 2,
              }}
            >
              <button
                onClick={() => change({ direction: 'ys' })}
                style={seg(direction === 'ys')}
              >
                Вчера → сегодня
              </button>
              <button
                onClick={() => change({ direction: 'st' })}
                style={seg(direction === 'st')}
              >
                Сегодня → завтра
              </button>
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={includeMisc}
                onChange={(e) => change({ include_misc: e.target.checked })}
                style={{ accentColor: 'var(--accent)' }}
              />
              + активности
            </label>
            <label
              title="Суммаризация задач через Claude API (без ключа — «задача — часы»)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={aiSum}
                onChange={(e) => change({ ai_summary: e.target.checked })}
                style={{ accentColor: 'var(--accent)' }}
              />
              AI-сводка
            </label>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
              Лимит, ч/мес
            </span>
            <input
              type="number"
              min={1}
              value={hoursLimit}
              onChange={(e) =>
                change({ hours_limit: Math.max(1, Number(e.target.value) || 1) })
              }
              className="mono"
              style={{
                width: 60,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '6px 8px',
                fontSize: '12.5px',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>
        )}
        <textarea
          value={loading && !text ? 'Генерируем…' : text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          style={{
            flex: 1,
            minHeight: 220,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            padding: '14px 16px',
            fontSize: '12.5px',
            lineHeight: 1.65,
            color: 'var(--text)',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: 14,
            opacity: loading ? 0.6 : 1,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => send('slack')}>
            → Slack
          </button>
          <button className="btn-ghost" onClick={() => send('tg')}>
            → Telegram
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Закрыть
          </button>
          <button
            onClick={copy}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              padding: '8px 18px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Копировать текст
          </button>
        </div>
      </div>
    </div>
  );
}
