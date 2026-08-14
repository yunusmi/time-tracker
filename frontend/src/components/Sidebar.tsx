'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { usePomodoro, PHASE_LABEL } from '@/context/PomodoroContext';
import { ROLE_LABEL, useWorkspace } from '@/context/WorkspaceContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Avatar, Logo, WorkspaceBadge } from '@/components/Logo';
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
    href: '/dashboard/notifications',
    label: 'Уведомления',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 6.6a4 4 0 018 0c0 3 1 3.9 1 3.9H3s1-.9 1-3.9z" />
        <path d="M6.6 12.6a1.6 1.6 0 002.8 0" />
      </svg>
    ),
  },
  {
    href: '/dashboard/timesheets',
    label: 'Таймшиты',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="2" width="10" height="12" rx="2" />
        <path d="M5.5 8.2l1.7 1.7 3.3-3.5" />
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
];

const SETTINGS_ITEM = {
  href: '/dashboard/settings',
  label: 'Настройки',
  icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.3" />
      <circle cx="8" cy="8" r="5.9" />
    </svg>
  ),
};

const KB_ITEM = {
  href: '/dashboard/help',
  label: 'База знаний',
  icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3.4h4a2 2 0 012 2v7.2a1.6 1.6 0 00-1.6-1.6H3z" />
      <path d="M13 3.4H9a2 2 0 00-2 2v7.2a1.6 1.6 0 011.6-1.6H13z" />
    </svg>
  ),
};

export function Sidebar({ mobileOpen = false }: { mobileOpen?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, cycleTheme, themeLabel } = useTheme();
  const pomo = usePomodoro();
  const { role, canSeeProjects, isClient, me, workspaces, switchWorkspace } =
    useWorkspace();
  const { unread } = useNotifications();
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);

  const showMiniPomo = pomo.running && pathname !== '/dashboard/pomodoro';
  // Настройки — отдельная страница с разделами: при входе меню скрывается.
  const inSettings = pathname.startsWith('/dashboard/settings');

  useEffect(() => {
    if (!wsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!wsRef.current?.contains(e.target as Node)) setWsOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [wsOpen]);

  // Гейты навигации по ролям: клиент видит только Отчёты, Настройки и базу
  // знаний; «Проекты» — admin+ и менеджер.
  const visibleNav = NAV.filter((item) => {
    if (isClient) {
      return (
        item.href === '/dashboard/reports' ||
        item.href === '/dashboard/notifications'
      );
    }
    if (item.href === '/dashboard/projects') return canSeeProjects;
    return true;
  });

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 10px 14px' }}>
        <Logo size={22} color={me?.brand_color ?? '#6366f1'} />
        <span style={{ fontWeight: 700, fontSize: '14.5px', letterSpacing: '0.01em' }}>
          Хронос
        </span>
      </div>

      {inSettings ? (
        <button
          className="nav-btn"
          onClick={() => router.push('/dashboard')}
          style={{ fontSize: 13 }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M9.5 4L5.5 8l4 4" />
          </svg>
          Вернуться в кабинет
        </button>
      ) : (
        visibleNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-btn ${pathname === item.href ? 'on' : ''}`}
          >
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.href === '/dashboard/notifications' && unread > 0 && (
              <span
                className="mono"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '1px 6px',
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                {unread}
              </span>
            )}
          </Link>
        ))
      )}

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

      {/* Переключатель компаний: роль в каждой, «Создать компанию». */}
      {me && (
        <div className="ws-switch" ref={wsRef}>
          {wsOpen && (
            <div className="ws-menu">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  className="menu-item"
                  onClick={() => {
                    setWsOpen(false);
                    if (!ws.active) void switchWorkspace(ws.id);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%' }}
                >
                  <WorkspaceBadge
                    name={ws.name}
                    logoUrl={ws.logo_url}
                    color={ws.brand_color}
                    size={20}
                  />
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ws.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {ROLE_LABEL[ws.role]}
                    </span>
                  </span>
                  {ws.active && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </button>
              ))}
              <Link
                href="/dashboard/workspaces/new"
                className="menu-item"
                onClick={() => setWsOpen(false)}
                style={{ display: 'block' }}
              >
                + Создать компанию
              </Link>
            </div>
          )}
          <button onClick={() => setWsOpen((o) => !o)}>
            <WorkspaceBadge
              name={me.workspace_name}
              logoUrl={me.logo_url}
              color={me.brand_color}
              size={22}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
              }}
            >
              {me.workspace_name}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
          </button>
        </div>
      )}

      <Link
        href={KB_ITEM.href}
        className={`nav-btn ${pathname === KB_ITEM.href ? 'on' : ''}`}
      >
        {KB_ITEM.icon}
        {KB_ITEM.label}
      </Link>

      <Link
        href={SETTINGS_ITEM.href}
        className={`nav-btn ${inSettings ? 'on' : ''}`}
      >
        {SETTINGS_ITEM.icon}
        {SETTINGS_ITEM.label}
      </Link>

      <button className="nav-btn" onClick={cycleTheme} style={{ fontSize: 13 }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3.4" />
          <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8" />
        </svg>
        {themeLabel}
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
        <Avatar name={user?.name ?? ''} src={user?.avatar_url} size={26} />
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
            {ROLE_LABEL[role]} · Выйти
          </button>
        </div>
      </div>
      {/* theme используется для доступности контраста иконки */}
      <span hidden>{theme}</span>
    </aside>
  );
}
