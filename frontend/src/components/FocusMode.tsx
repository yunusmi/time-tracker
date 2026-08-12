'use client';

import { useEffect } from 'react';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';
import { entryTitle } from '@/components/Header';
import { formatTicker } from '@/lib/format';
import { entryProjectColor, entryProjectName } from '@/lib/project';

/** Полноэкранный фокус-режим: проект, название, крупный таймер, «Стоп». */
export function FocusMode() {
  const { active, elapsedSeconds, focusMode, setFocusMode, stop } = useTimer();
  const { toast } = useToast();

  const visible = focusMode && !!active;

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, setFocusMode]);

  if (!visible || !active) return null;

  async function onStop() {
    try {
      await stop();
      toast('Таймер остановлен, запись сохранена');
    } catch {
      toast('Не удалось остановить таймер');
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        zIndex: 65,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--muted)',
          fontSize: 14,
        }}
      >
        <span
          className="pdot"
          style={{ width: 8, height: 8, background: entryProjectColor(active) }}
        />
        {entryProjectName(active)}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, maxWidth: 600, textAlign: 'center' }}>
        {entryTitle(active)}
      </div>
      <div className="mono" style={{ fontSize: 96, fontWeight: 600 }}>
        {formatTicker(elapsedSeconds)}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
        <button
          className="btn btn-red"
          style={{ borderRadius: 9, padding: '11px 28px', fontSize: 14 }}
          onClick={onStop}
        >
          ■ Стоп
        </button>
        <button
          onClick={() => setFocusMode(false)}
          style={{
            background: 'transparent',
            color: 'var(--muted)',
            border: '1px solid var(--border2)',
            borderRadius: 9,
            padding: '11px 20px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Выйти (Esc)
        </button>
      </div>
    </div>
  );
}
