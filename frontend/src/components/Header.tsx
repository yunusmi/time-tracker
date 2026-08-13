'use client';

import { usePathname } from 'next/navigation';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';
import { formatTicker } from '@/lib/format';
import { NotificationsBell } from '@/components/NotificationsBell';

const TITLES: Record<string, string> = {
  '/dashboard': 'Трекер',
  '/dashboard/tasks': 'Задачи',
  '/dashboard/projects': 'Проекты',
  '/dashboard/reports': 'Отчёты',
  '/dashboard/timesheets': 'Таймшиты',
  '/dashboard/pomodoro': 'Pomodoro',
  '/dashboard/team': 'Команда',
  '/dashboard/settings': 'Настройки',
};

export function entryTitle(entry: {
  task?: { title: string } | null;
  description: string | null;
}): string {
  return entry.task?.title || entry.description || 'Без названия';
}

export function Header({ onBurger }: { onBurger?: () => void }) {
  const pathname = usePathname();
  const { active, elapsedSeconds, stop } = useTimer();
  const { toast } = useToast();

  const chipVisible = !!active && pathname !== '/dashboard';

  async function onStop() {
    try {
      await stop();
      toast('Таймер остановлен, запись сохранена');
    } catch {
      toast('Не удалось остановить таймер');
    }
  }

  return (
    <header className="topbar">
      <button className="burger" title="Меню" onClick={onBurger}>
        ☰
      </button>
      <span style={{ fontWeight: 600, fontSize: '14.5px' }}>
        {TITLES[pathname] ?? 'Хронос'}
      </span>
      <div style={{ flex: 1 }} />
      <NotificationsBell />
      <button
        title="Командная палитра (Cmd+K)"
        onClick={() => window.dispatchEvent(new Event('tt-open-palette'))}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: '5px 10px',
          fontSize: 12,
          color: 'var(--muted)',
          cursor: 'pointer',
        }}
      >
        <span className="mono" style={{ fontSize: 11 }}>
          ⌘K
        </span>
        Поиск и команды
      </button>
      {chipVisible && active && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--asoft)',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            padding: '5px 6px 5px 12px',
          }}
        >
          <div
            className="pulse"
            style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }}
          />
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 500,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entryTitle(active)}
          </span>
          <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
            {formatTicker(elapsedSeconds)}
          </span>
          <button
            onClick={onStop}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Стоп
          </button>
        </div>
      )}
    </header>
  );
}
