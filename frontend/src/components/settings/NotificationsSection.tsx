'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationPrefs,
} from '@/lib/types';

/** События матрицы и их дефолты (совпадают с бэкендом). */
const EVENTS: {
  key: NotificationEvent;
  label: string;
  hint: string;
  clientVisible: boolean;
}[] = [
  {
    key: 'task_assigned',
    label: 'Назначение задачи',
    hint: 'Вам поставили задачу',
    clientVisible: false,
  },
  {
    key: 'admin_edits',
    label: 'Правки админа',
    hint: 'Админ изменил ваши записи времени',
    clientVisible: false,
  },
  {
    key: 'timesheet_status',
    label: 'Статус таймшита',
    hint: 'Утверждён или возвращён с причиной',
    clientVisible: false,
  },
  {
    key: 'standup_reminder',
    label: 'Напоминание о стендапе',
    hint: 'Будни, 09:30',
    clientVisible: false,
  },
  {
    key: 'weekly_digest',
    label: 'Дайджест недели',
    hint: 'Понедельник: часы, задачи, стрик',
    clientVisible: true,
  },
];

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'push', label: 'Пуш' },
  { key: 'app', label: 'В кабинете' },
];

const DEFAULTS: Record<NotificationChannel, boolean> = {
  email: true,
  push: false,
  app: true,
};

type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Настройки → Уведомления: матрица Email / Пуш / В кабинете по каждому
 * событию + карточка разрешения браузера на веб-пуши (ТЗ «Каналы уведомлений»).
 */
export function NotificationsSection() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { isClient } = useWorkspace();

  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [pushState, setPushState] = useState<PushState>('default');
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    setPrefs(settings.notification_prefs ?? {});
  }, [settings.notification_prefs]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setPushState('unsupported');
      return;
    }
    setPushState(Notification.permission as PushState);
    api
      .getVapidKey()
      .then((k) => setPushEnabled(k.enabled))
      .catch(() => setPushEnabled(false));
  }, []);

  function valueOf(
    event: NotificationEvent,
    channel: NotificationChannel,
  ): boolean {
    return prefs[event]?.[channel] ?? DEFAULTS[channel];
  }

  function toggle(event: NotificationEvent, channel: NotificationChannel) {
    if (channel === 'push' && pushState !== 'granted') {
      toast('Сначала разрешите пуши в браузере');
      return;
    }
    const next: NotificationPrefs = {
      ...prefs,
      [event]: { ...(prefs[event] ?? {}), [channel]: !valueOf(event, channel) },
    };
    setPrefs(next);
    updateSettings({ notification_prefs: next });
  }

  /** Запрос разрешения + подписка на Web Push (VAPID). */
  async function requestPush() {
    try {
      const permission = await Notification.requestPermission();
      setPushState(permission as PushState);
      if (permission !== 'granted') {
        toast('Пуши заблокированы в настройках браузера');
        return;
      }
      const { public_key, enabled } = await api.getVapidKey();
      if (!enabled || !public_key) {
        toast('Пуши включатся, когда сервер получит VAPID-ключи');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh: string; auth: string };
      };
      if (json.endpoint && json.keys) {
        await api.subscribePush({ endpoint: json.endpoint, keys: json.keys });
      }
      toast('Пуш-уведомления подключены');
    } catch {
      toast('Не удалось подключить пуши');
    }
  }

  const events = EVENTS.filter((e) => !isClient || e.clientVisible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Веб-пуши
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          {pushState === 'unsupported'
            ? 'Браузер не поддерживает веб-пуши.'
            : pushState === 'granted'
              ? 'Разрешение получено — колонка «Пуш» доступна.'
              : pushState === 'denied'
                ? 'Пуши заблокированы: разрешите их в настройках сайта в браузере.'
                : 'Разрешение не запрошено. Пока его нет, колонка «Пуш» не включается.'}
          {pushState === 'granted' && !pushEnabled
            ? ' Сервер пока без VAPID-ключей — доставка появится после их настройки.'
            : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              padding: '3px 10px',
              background:
                pushState === 'granted'
                  ? 'var(--gsoft)'
                  : pushState === 'denied'
                    ? 'var(--rsoft)'
                    : 'var(--ysoft)',
              color:
                pushState === 'granted'
                  ? 'var(--green)'
                  : pushState === 'denied'
                    ? 'var(--red)'
                    : 'var(--amber)',
            }}
          >
            {pushState === 'granted'
              ? 'Разрешены'
              : pushState === 'denied'
                ? 'Заблокированы'
                : pushState === 'unsupported'
                  ? 'Недоступны'
                  : 'Не запрошены'}
          </span>
          {(pushState === 'default' || pushState === 'granted') && (
            <button className="btn btn-outline" onClick={() => void requestPush()}>
              {pushState === 'granted' ? 'Переподключить' : 'Разрешить пуши'}
            </button>
          )}
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Каналы по событиям
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 14 }}>
          Для каждого события — три независимых канала доставки.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="notif-matrix">
            <thead>
              <tr>
                <th>Событие</th>
                {CHANNELS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.key}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.label}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      {e.hint}
                    </div>
                  </td>
                  {CHANNELS.map((c) => (
                    <td key={c.key}>
                      <input
                        type="checkbox"
                        checked={valueOf(e.key, c.key)}
                        disabled={c.key === 'push' && pushState !== 'granted'}
                        onChange={() => toggle(e.key, c.key)}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!isClient && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Напоминания в браузере
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
            Локальные уведомления вкладки — не требуют пуш-подписки.
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={settings.notify_day_start}
              onChange={(e) => {
                updateSettings({ notify_day_start: e.target.checked });
                if (
                  e.target.checked &&
                  'Notification' in window &&
                  Notification.permission === 'default'
                ) {
                  void Notification.requestPermission();
                }
              }}
              style={{ accentColor: 'var(--accent)' }}
            />
            Напомнить начать трекинг в начале дня
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={settings.notify_goal_reached}
              onChange={(e) =>
                updateSettings({ notify_goal_reached: e.target.checked })
              }
              style={{ accentColor: 'var(--accent)' }}
            />
            Сообщить, когда цель дня достигнута
          </label>
        </div>
      )}
    </div>
  );
}
