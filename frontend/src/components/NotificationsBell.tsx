'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/context/NotificationsContext';
import type { AppNotification } from '@/lib/types';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString('ru-RU', { weekday: 'short' })}, ${time}`;
}

/** Экран действия уведомления: /dashboard/<action_screen>. */
export function actionHref(n: AppNotification): string {
  return n.action_screen ? `/dashboard/${n.action_screen}` : '/dashboard';
}

/** Колокольчик — быстрый доступ; «Все» ведёт на экран «Уведомления». */
export function NotificationsBell() {
  const router = useRouter();
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) void markAllRead();
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        title="Уведомления"
        onClick={toggle}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: '6px 9px',
          color: 'var(--muted)',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2a4 4 0 00-4 4v2.5L2.8 11h10.4L12 8.5V6a4 4 0 00-4-4z" />
          <path d="M6.5 13a1.5 1.5 0 003 0" />
        </svg>
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 3,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--red)',
            }}
          />
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            left: 'auto',
            width: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: 10,
            boxShadow: 'var(--shadow)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Уведомления
            <div style={{ flex: 1 }} />
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              style={{ color: 'var(--accent)', fontSize: 12 }}
            >
              Все
            </Link>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {items.slice(0, 10).map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  router.push(actionHref(n));
                }}
                style={{
                  display: 'flex',
                  gap: 9,
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '12.5px',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderBottomWidth: 1,
                  borderBottomStyle: 'solid',
                  borderBottomColor: 'var(--border)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: `var(--${n.dot === 'accent' ? 'accent' : n.dot})`,
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block' }}>{n.text}</span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: 'var(--muted)',
                      marginTop: 1,
                    }}
                  >
                    {timeLabel(n.created_at)}
                  </span>
                </span>
              </button>
            ))}
            {items.length === 0 && (
              <div
                style={{
                  padding: 18,
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: '12.5px',
                }}
              >
                Нет уведомлений
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
