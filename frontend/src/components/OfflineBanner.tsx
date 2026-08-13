'use client';

import { useEffect, useState } from 'react';
import { flushQueue, readQueue } from '@/lib/offline';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';

/**
 * Индикатор оффлайна + синхронизация очереди ручных записей
 * (записи, добавленные без сети, хранятся в localStorage).
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const { bumpVersion } = useTimer();
  const { toast } = useToast();

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const onOnline = () => {
      update();
      void flushQueue().then((sent) => {
        if (sent > 0) {
          toast(`Подключение восстановлено — синхронизировано записей: ${sent}`);
          bumpVersion();
        }
      });
    };
    update();
    // При старте тоже пробуем дослать то, что скопилось.
    if (navigator.onLine && readQueue().length > 0) onOnline();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', update);
    };
  }, [bumpVersion, toast]);

  if (!offline) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'var(--amber)',
        color: '#1a1206',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        padding: 4,
        zIndex: 80,
      }}
    >
      Оффлайн — записи сохраняются локально и синхронизируются при подключении
    </div>
  );
}
