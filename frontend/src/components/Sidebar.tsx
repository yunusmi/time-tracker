'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { usePomodoro, PHASE_LABEL } from '@/context/PomodoroContext';
import { formatClock } from '@/lib/format';

const NAV = [
  {
    href: '/dashboard',
    label: 'Трекер',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 5v3.2l2 1.4" />
      </svg>
    ),
  },
  {
    href: '/dashboard/tasks',
    label: 'Задачи',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2.5" y="2.5" width="11" height="11" rx="3.5" />
        <path d="M5.4 8.1l1.8 1.8 3.4-3.7" />
      </svg>
    ),
  },
  {
    href: '/dashboard/projects',
    label: 'Проекты',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4.5A1.5 1.5 0 013.5 3h2.6l1.4 1.8h5A1.5 1.5 0 0114 6.3v5.2a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/reports',
    label: 'Отчёты',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M3.5 13.5V9.5" />
        <path d="M8 13.5V3.5" />
        <path d="M12.5 13.5V7" />
      </svg>
    ),
  },
  {
    href: '/dashboard/pomodoro',
    label: 'Pomodoro',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="9" r="5.3" />
        <path d="M8 3.7V1.8" />
        <path d="M5.8 2.6h4.4" />
      </svg>
    ),
  },
  {
    href: '/dashboard/team',
    label: 'Команда',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="5.6" cy="6" r="2.6" />
        <circle cx="11.2" cy="7.2" r="2" />
        <path d="M2 13.4c.6-2.3 2-3.4 3.6-3.4s3 1.1 3.6 3.4" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Настройки',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="2.3" />
        <circle cx="8" cy="8" r="5.9" />
      </svg>
    ),
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pomo = usePomodoro();

  const showMiniPomo = pomo.running && pathname !== '/dashboard/pomodoro';

  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 10px 14px' }}>
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
        <span style={{ fontWeight: 700, fontSize: '14.5px', letterSpacing: '0.01em' }}>
          Хронос
        </span>
      </div>

      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-btn ${pathname === item.href ? 'on' : ''}`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}

      <div style={{ flex: 1 }} />

      {showMiniPomo && (
        <Link
          href="/dashboard/pomodoro"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '0 2px 10px',
            padding: '9px 11px',
            borderRadius: 9,
            border: '1px solid var(--border2)',
            background: 'var(--surface2)',
            color: 'var(--text)',
          }}
        >
          <div
            className="pulse"
            style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)' }}
          />
          <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
            {formatClock(pomo.secondsLeft)}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {PHASE_LABEL[pomo.phase]}
          </span>
        </Link>
      )}

      <button className="nav-btn" onClick={toggleTheme} style={{ fontSize: 13 }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3.4" />
          <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8" />
        </svg>
        {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '9px 10px 2px',
          borderTop: '1px solid var(--border)',
          marginTop: 8,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--asoft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {user ? initials(user.name) : '·'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12.5px',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.name}
          </div>
          <button
            onClick={logout}
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}
