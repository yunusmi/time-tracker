'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '@/lib/api';

export type Theme = 'dark' | 'light';
/** Третий режим — «как в системе» (prefers-color-scheme). */
export type ThemeMode = Theme | 'system';

const THEME_KEY = 'tt_theme';

const MODE_LABEL: Record<ThemeMode, string> = {
  dark: 'Тёмная тема',
  light: 'Светлая тема',
  system: 'Как в системе',
};

function systemTheme(): Theme {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

interface ThemeContextValue {
  /** Фактически применённая тема. */
  theme: Theme;
  /** Выбранный режим (включая «как в системе»). */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Переключение по кругу: тёмная → светлая → как в системе. */
  cycleTheme: () => void;
  toggleTheme: () => void;
  themeLabel: string;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [theme, setThemeState] = useState<Theme>('dark');

  const apply = useCallback((next: ThemeMode) => {
    const effective = next === 'system' ? systemTheme() : next;
    setThemeState(effective);
    document.documentElement.setAttribute('data-theme', effective);
  }, []);

  // Подхватываем значение, выставленное скриптом до гидратации.
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY) as ThemeMode | null;
    const initial: ThemeMode =
      saved === 'light' || saved === 'dark' || saved === 'system'
        ? saved
        : 'dark';
    setModeState(initial);
    apply(initial);
  }, [apply]);

  // В режиме «как в системе» следим за сменой системной темы.
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode, apply]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      apply(next);
      window.localStorage.setItem(THEME_KEY, next);
      // Дублируем в настройки пользователя на сервере (не блокируя UI).
      const stored: Theme = next === 'system' ? systemTheme() : next;
      api.updateUserSettings({ theme: stored }).catch(() => undefined);
    },
    [apply],
  );

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['dark', 'light', 'system'];
    setMode(order[(order.indexOf(mode) + 1) % order.length]);
  }, [mode, setMode]);

  const toggleTheme = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setMode]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        setMode,
        cycleTheme,
        toggleTheme,
        themeLabel: MODE_LABEL[mode],
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
