'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

const POLL_MS = 60_000;

interface NotificationsContextValue {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

const NotificationsContext = createContext<
  NotificationsContextValue | undefined
>(undefined);

/**
 * Центр уведомлений: общий стейт для колокольчика в шапке, счётчика
 * непрочитанных в сайдбаре и экрана «Уведомления».
 */
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.listNotifications({ limit: 30 });
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      /* не критично */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.readAllNotifications().catch(() => undefined);
  }, []);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));
    await api.readNotification(id).catch(() => undefined);
  }, []);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await api.deleteNotification(id).catch(() => undefined);
  }, []);

  const clear = useCallback(async () => {
    setItems([]);
    setUnread(0);
    await api.clearNotifications().catch(() => undefined);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ items, unread, loading, refresh, markAllRead, markRead, remove, clear }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within NotificationsProvider',
    );
  }
  return ctx;
}
