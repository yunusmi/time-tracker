'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/context/NotificationsContext';
import { actionHref } from '@/components/NotificationsBell';
import { SkeletonRows } from '@/components/Skeleton';
import type { AppNotification, NotificationKind } from '@/lib/types';

type Filter = 'all' | 'unread' | 'timesheets' | 'tasks';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'unread', label: 'Непрочитанные' },
  { key: 'timesheets', label: 'Таймшиты' },
  { key: 'tasks', label: 'Задачи' },
];

const KIND_LABEL: Record<NotificationKind, string> = {
  task: 'Задача',
  timesheet: 'Таймшит',
  standup: 'Стендап',
  digest: 'Дайджест',
  system: 'Система',
};

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  push: 'Пуш',
  app: 'В кабинете',
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  })}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Экран «Уведомления» (для всех ролей): фильтры, тип, каналы, кнопка
 * действия и удаление; «Отметить всё прочитанным» и ссылка на каналы.
 */
export default function NotificationsPage() {
  const { items, unread, loading, markAllRead, markRead, remove, clear } =
    useNotifications();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.read);
    if (filter === 'timesheets') return items.filter((n) => n.kind === 'timesheet');
    if (filter === 'tasks') return items.filter((n) => n.kind === 'task');
    return items;
  }, [items, filter]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div className="seg seg-flat">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'on' : ''}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key === 'unread' && unread > 0 ? ` · ${unread}` : ''}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {unread > 0 && (
          <button className="btn btn-ghost" onClick={() => void markAllRead()}>
            Отметить всё прочитанным
          </button>
        )}
        <Link
          href="/dashboard/settings?section=notifications"
          className="btn btn-ghost"
        >
          Настройки каналов
        </Link>
        {items.length > 0 && (
          <button className="btn btn-ghost" onClick={() => void clear()}>
            Очистить
          </button>
        )}
      </div>

      <div className="card card-pad">
        {loading ? (
          <SkeletonRows rows={5} height={54} />
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Пока пусто</div>
            <div className="empty-sub">
              {filter === 'unread'
                ? 'Все уведомления прочитаны'
                : 'Здесь появятся назначенные задачи, статусы таймшитов и напоминания'}
            </div>
          </div>
        ) : (
          filtered.map((n) => <NotificationRow key={n.id} n={n} onRead={markRead} onRemove={remove} />)
        )}
      </div>
    </>
  );
}

function NotificationRow({
  n,
  onRead,
  onRemove,
}: {
  n: AppNotification;
  onRead: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <div
      className="list-row"
      style={{ alignItems: 'flex-start', gap: 11, padding: '11px 4px' }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: `var(--${n.dot === 'accent' ? 'accent' : n.dot})`,
          flexShrink: 0,
          marginTop: 6,
          opacity: n.read ? 0.4 : 1,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: n.read ? 400 : 600 }}>
          {n.text}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 4,
            flexWrap: 'wrap',
          }}
        >
          <span className="chip-badge">{KIND_LABEL[n.kind] ?? 'Система'}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {timeLabel(n.created_at)}
          </span>
          {(n.channels ?? []).length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              · {n.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')}
            </span>
          )}
        </div>
      </div>
      <Link
        href={actionHref(n)}
        className="btn btn-ghost"
        onClick={() => void onRead(n.id)}
        style={{ flexShrink: 0 }}
      >
        Открыть
      </Link>
      <button
        className="icon-x"
        title="Удалить"
        onClick={() => void onRemove(n.id)}
      >
        ✕
      </button>
    </div>
  );
}
