'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '@/lib/api';

/**
 * Пользовательские настройки (цель дня, порог простоя, напоминания).
 * Хранятся на сервере (GET/PATCH /users/me/settings) и дублируются
 * в localStorage для мгновенного старта без ожидания сети.
 */
export interface UserSettings {
  daily_goal_hours: number;
  idle_threshold_minutes: number;
  notify_day_start: boolean;
  notify_goal_reached: boolean;
}

const DEFAULTS: UserSettings = {
  daily_goal_hours: 6,
  idle_threshold_minutes: 10,
  notify_day_start: false,
  notify_goal_reached: false,
};

const SETTINGS_KEY = 'tt_settings';
const THEME_KEY = 'tt_theme';

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

function persistLocal(settings: UserSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);

  useEffect(() => {
    // 1) мгновенно — из localStorage;
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed data */
    }
    // 2) затем — актуальные с сервера.
    api
      .getUserSettings()
      .then((server) => {
        const next: UserSettings = {
          daily_goal_hours: server.daily_goal_hours,
          idle_threshold_minutes: server.idle_threshold_minutes,
          notify_day_start: server.notify_day_start,
          notify_goal_reached: server.notify_goal_reached,
        };
        setSettings(next);
        persistLocal(next);
        // Тема с сервера — только если на этом устройстве ещё нет выбора.
        if (!window.localStorage.getItem(THEME_KEY)) {
          document.documentElement.setAttribute('data-theme', server.theme);
          window.localStorage.setItem(THEME_KEY, server.theme);
        }
      })
      .catch(() => {
        /* оффлайн/старый бэкенд — работаем на localStorage */
      });
  }, []);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistLocal(next);
      return next;
    });
    api.updateUserSettings(patch).catch(() => {
      /* не блокируем UI; при следующей загрузке возьмём серверные */
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
