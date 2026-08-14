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
import { chime, notify } from '@/lib/notify';
import { useToast } from '@/context/ToastContext';
import { useTimer } from '@/context/TimerContext';
import type { PomodoroPhase, PomodoroSettings } from '@/lib/types';

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  work: 'Фокус',
  short_break: 'Перерыв',
  long_break: 'Длинный перерыв',
};

export function phaseSeconds(
  phase: PomodoroPhase,
  s: PomodoroSettings,
): number {
  if (phase === 'work') return s.work_minutes * 60;
  if (phase === 'short_break') return s.short_break_minutes * 60;
  return s.long_break_minutes * 60;
}

interface PomodoroContextValue {
  settings: PomodoroSettings | null;
  phase: PomodoroPhase;
  secondsLeft: number;
  running: boolean;
  /** Завершённых фокус-сессий в текущей серии (для «цикл N из M»). */
  cycleCount: number;
  taskId: string;
  /** Инкрементируется после записи сессии — сигнал обновить статистику. */
  statsVersion: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  switchPhase: (phase: PomodoroPhase) => void;
  setTaskId: (id: string) => void;
  saveSettings: (patch: Partial<PomodoroSettings>) => Promise<void>;
}

const PomodoroContext = createContext<PomodoroContextValue | undefined>(
  undefined,
);

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { bumpVersion } = useTimer();
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const [phase, setPhase] = useState<PomodoroPhase>('work');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [statsVersion, setStatsVersion] = useState(0);

  const deadlineRef = useRef(0);
  // Зеркала состояния для чтения внутри интервала (избегаем устаревших замыканий).
  const refs = useRef({ phase, settings, taskId, cycleCount });
  refs.current = { phase, settings, taskId, cycleCount };

  useEffect(() => {
    api
      .getPomodoroSettings()
      .then((s) => {
        setSettings(s);
        setSecondsLeft(s.work_minutes * 60);
      })
      .catch(() => {
        /* оболочка работает и без настроек pomodoro */
      });
  }, []);

  const handleComplete = useCallback(async () => {
    const { phase: cur, settings: s, taskId: tid, cycleCount: cc } =
      refs.current;
    if (!s) return;
    const duration = phaseSeconds(cur, s);
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - duration * 1000);

    try {
      await api.createPomodoroSession({
        phase: cur,
        duration_seconds: duration,
        completed: true,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        task_id: cur === 'work' && tid ? tid : undefined,
      });
      setStatsVersion((v) => v + 1);
    } catch {
      /* не роняем таймер из-за ошибки записи */
    }

    // «Записывать фокус-сессии в трекер» — создаём запись времени на длительность сессии.
    if (cur === 'work' && s.track_to_timer) {
      try {
        await api.createManualEntry({
          task_id: tid || undefined,
          description: tid ? undefined : 'Фокус-сессия Pomodoro',
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
        });
        bumpVersion();
      } catch {
        /* необязательная запись — не мешаем таймеру */
      }
    }

    // Сигнал и браузерное уведомление о завершении фазы (ТЗ, polish-батч).
    chime();
    notify(
      cur === 'work' ? 'Фокус-сессия завершена' : 'Перерыв закончился',
      cur === 'work'
        ? 'Время сделать перерыв — таймер переключён.'
        : 'Возвращаемся к работе.',
    );

    let next: PomodoroPhase;
    if (cur === 'work') {
      const done = cc + 1;
      setCycleCount(done);
      next = done % s.long_break_interval === 0 ? 'long_break' : 'short_break';
    } else {
      next = 'work';
    }

    setPhase(next);
    const nextSeconds = phaseSeconds(next, s);
    setSecondsLeft(nextSeconds);
    if (s.auto_start) {
      deadlineRef.current = Date.now() + nextSeconds * 1000;
      setRunning(true);
    } else {
      setRunning(false);
    }
    // DND действует только во время фокус-фазы.
    api
      .updateUserSettings({
        dnd_until:
          s.auto_start && next === 'work'
            ? new Date(Date.now() + nextSeconds * 1000).toISOString()
            : null,
      })
      .catch(() => undefined);
    toast(
      cur === 'work'
        ? 'Фокус-сессия завершена — перерыв!'
        : 'Перерыв окончен — за работу.',
    );
  }, [toast, bumpVersion]);

  // Тик по дедлайну — не дрейфует при троттлинге вкладки.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = Math.round((deadlineRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        clearInterval(id);
        void handleComplete();
      } else {
        setSecondsLeft(remaining);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, handleComplete]);

  /** «Не беспокоить» в команде на время фокус-сессии. */
  const setDnd = useCallback((until: Date | null) => {
    api
      .updateUserSettings({ dnd_until: until ? until.toISOString() : null })
      .catch(() => undefined);
  }, []);

  const start = useCallback(() => {
    deadlineRef.current = Date.now() + Math.max(1, secondsLeft) * 1000;
    setRunning(true);
    if (phase === 'work') setDnd(new Date(deadlineRef.current));
  }, [secondsLeft, phase, setDnd]);

  const pause = useCallback(() => {
    setRunning(false);
    setDnd(null);
  }, [setDnd]);

  const reset = useCallback(() => {
    setRunning(false);
    setDnd(null);
    if (settings) setSecondsLeft(phaseSeconds(phase, settings));
  }, [settings, phase, setDnd]);

  const switchPhase = useCallback(
    (p: PomodoroPhase) => {
      setRunning(false);
      setPhase(p);
      if (settings) setSecondsLeft(phaseSeconds(p, settings));
    },
    [settings],
  );

  const saveSettings = useCallback(
    async (patch: Partial<PomodoroSettings>) => {
      const updated = await api.updatePomodoroSettings(patch);
      setSettings(updated);
      if (!running) {
        setSecondsLeft(phaseSeconds(refs.current.phase, updated));
      }
    },
    [running],
  );

  return (
    <PomodoroContext.Provider
      value={{
        settings,
        phase,
        secondsLeft,
        running,
        cycleCount,
        taskId,
        statsVersion,
        start,
        pause,
        reset,
        switchPhase,
        setTaskId,
        saveSettings,
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
}
