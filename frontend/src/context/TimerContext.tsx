'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/context/SettingsContext';
import type { TimeEntry } from '@/lib/types';

const POLL_INTERVAL_MS = 20_000;

interface TimerContextValue {
  /** Текущая активная запись времени (null — таймер не идёт). */
  active: TimeEntry | null;
  /** Секунд прошло с начала активного таймера (тикает раз в секунду). */
  elapsedSeconds: number;
  /** Инкрементируется после каждого start/stop — сигнал страницам перезагрузить списки. */
  version: number;
  /** Полноэкранный фокус-режим. */
  focusMode: boolean;
  setFocusMode: (on: boolean) => void;
  /** Таймер идёт, а активности нет дольше порога из настроек. */
  idle: boolean;
  /** Минут без активности (для баннера). */
  idleMinutes: number;
  /** «Я работаю» — сбросить простой. */
  keepWorking: () => void;
  /** «Стоп и вычесть простой» — закрыть запись моментом последней активности. */
  stopSubtractingIdle: () => Promise<void>;
  start: (body: { task_id?: string; description?: string }) => Promise<void>;
  stop: (endedAt?: string) => Promise<TimeEntry | null>;
  refresh: () => Promise<void>;
  /** Сообщить, что записи времени изменились извне (например, pomodoro создал entry). */
  bumpVersion: () => void;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [version, setVersion] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [idle, setIdle] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const lastActivityRef = useRef(Date.now());
  const idleThresholdRef = useRef(settings.idle_threshold_minutes);
  idleThresholdRef.current = settings.idle_threshold_minutes;

  // Отслеживаем активность пользователя для контроля простоя.
  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') bump();
    };
    window.addEventListener('mousemove', bump);
    window.addEventListener('keydown', bump);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('keydown', bump);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const a = await api.activeEntry();
      // Не перерисовываем, если состояние не изменилось.
      if ((a?.id ?? null) !== (activeRef.current?.id ?? null)) {
        setActive(a);
      }
    } catch {
      /* сеть/авторизация — не роняем оболочку */
    }
  }, []);

  // Начальная загрузка + периодический опрос (таймер могли запустить в другой вкладке).
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Секундный тик, пока таймер идёт; заодно проверяем простой.
  useEffect(() => {
    if (!active) {
      setIdle(false);
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
      if (
        Date.now() - lastActivityRef.current >
        idleThresholdRef.current * 60_000
      ) {
        setIdle(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const start = useCallback(
    async (body: { task_id?: string; description?: string }) => {
      const entry = await api.startTimer(body);
      setActive(entry);
      setVersion((v) => v + 1);
    },
    [],
  );

  const stop = useCallback(async (endedAt?: string): Promise<TimeEntry | null> => {
    const stopped = await api.stopTimer(endedAt ? { ended_at: endedAt } : undefined);
    setActive(null);
    setFocusMode(false);
    setIdle(false);
    setVersion((v) => v + 1);
    return stopped;
  }, []);

  const keepWorking = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIdle(false);
  }, []);

  const stopSubtractingIdle = useCallback(async () => {
    // Не даём ended_at оказаться раньше started_at (минимум минута записи).
    const startedAt = activeRef.current
      ? new Date(activeRef.current.started_at).getTime()
      : 0;
    const endedAt = Math.min(
      Date.now(),
      Math.max(lastActivityRef.current, startedAt + 60_000),
    );
    await stop(new Date(endedAt).toISOString());
  }, [stop]);

  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  const idleMinutes = Math.max(
    1,
    Math.round((now - lastActivityRef.current) / 60_000),
  );

  const elapsedSeconds = active
    ? Math.max(0, Math.floor((now - new Date(active.started_at).getTime()) / 1000))
    : 0;

  return (
    <TimerContext.Provider
      value={{
        active,
        elapsedSeconds,
        version,
        focusMode,
        setFocusMode,
        idle,
        idleMinutes,
        keepWorking,
        stopSubtractingIdle,
        start,
        stop,
        refresh,
        bumpVersion,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
