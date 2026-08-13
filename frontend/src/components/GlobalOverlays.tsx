'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { projectName } from '@/lib/project';
import type { TaskWithStats, TimeEntry } from '@/lib/types';
import { useTheme } from '@/context/ThemeContext';
import { useTimer } from '@/context/TimerContext';
import { useToast } from '@/context/ToastContext';

const SCREENS: [string, string][] = [
  ['Трекер', '/dashboard'],
  ['Задачи', '/dashboard/tasks'],
  ['Проекты', '/dashboard/projects'],
  ['Отчёты', '/dashboard/reports'],
  ['Таймшиты', '/dashboard/timesheets'],
  ['Pomodoro', '/dashboard/pomodoro'],
  ['Команда', '/dashboard/team'],
  ['Настройки', '/dashboard/settings'],
];

const HOTKEYS: { k: string; d: string }[] = [
  { k: '⌘K', d: 'Палитра команд' },
  { k: 'S', d: 'Стоп / продолжить последнюю' },
  { k: 'N', d: 'Новая задача' },
  { k: 'F', d: 'Фокус-режим' },
  { k: 'T', d: 'Сменить тему' },
  { k: '1–8', d: 'Экраны' },
  { k: '?', d: 'Эта справка' },
  { k: 'Esc', d: 'Закрыть окна' },
];

interface PaletteItem {
  icon: string;
  label: string;
  hint: string;
  act: () => void | Promise<void>;
}

/** ⌘K-палитра, справка «?» и глобальные горячие клавиши. */
export function GlobalOverlays() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleTheme } = useTheme();
  const { active, start, stop, setFocusMode } = useTimer();
  const { toast } = useToast();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPalette = useCallback(() => {
    setPaletteOpen(true);
    setQuery('');
    setSelected(0);
    api
      .listTasks()
      .then((t) => setTasks(t.filter((x) => x.status !== 'done')))
      .catch(() => undefined);
    // История записей — для поиска и старта таймера из прошлого.
    api
      .listEntries()
      .then((e) => setHistory(e.filter((x) => x.ended_at).slice(0, 200)))
      .catch(() => undefined);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  // Кнопка «⌘K Поиск и команды» в шапке и «Горячие клавиши» в настройках.
  useEffect(() => {
    const onOpen = () => openPalette();
    const onHelp = () => setHelpOpen(true);
    window.addEventListener('tt-open-palette', onOpen);
    window.addEventListener('tt-open-help', onHelp);
    return () => {
      window.removeEventListener('tt-open-palette', onOpen);
      window.removeEventListener('tt-open-help', onHelp);
    };
  }, [openPalette]);

  const resumeLast = useCallback(async () => {
    try {
      const entries = await api.listEntries();
      const last = entries.find((e) => e.ended_at && (e.task_id || e.description));
      if (!last) {
        toast('Нечего продолжать');
        return;
      }
      if (last.task_id && last.task?.status === 'done') {
        toast('Последняя задача уже завершена');
        return;
      }
      await start({
        task_id: last.task_id ?? undefined,
        description: last.task_id ? undefined : (last.description ?? undefined),
      });
      toast(`Продолжаем: ${last.task?.title || last.description}`);
      router.push('/dashboard');
    } catch {
      toast('Не удалось продолжить');
    }
  }, [start, toast, router]);

  // Глобальные горячие клавиши.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(target.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setHelpOpen(false);
        return;
      }
      if (typing || paletteOpen || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') {
        setHelpOpen((o) => !o);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 't' || k === 'е') {
        toggleTheme();
      } else if (k === 'f' || k === 'а') {
        if (active) setFocusMode(true);
      } else if (k === 'n' || k === 'т') {
        router.push('/dashboard/tasks#new');
      } else if (k === 's' || k === 'ы') {
        if (active) {
          void stop().then(() => toast('Таймер остановлен (S)')).catch(() => undefined);
        } else {
          void resumeLast();
        }
      } else {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < SCREENS.length) {
          router.push(SCREENS[idx][1]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, active, openPalette, toggleTheme, setFocusMode, router, stop, toast, resumeLast]);

  // Пункты палитры.
  const items = useMemo<PaletteItem[]>(() => {
    if (!paletteOpen) return [];
    const q = query.trim().toLowerCase();
    const out: PaletteItem[] = [];
    const close = () => setPaletteOpen(false);

    if (q) {
      out.push({
        icon: '▶',
        label: `Запустить таймер: «${query.trim()}»`,
        hint: 'Enter',
        act: async () => {
          close();
          await start({ description: query.trim() });
          router.push('/dashboard');
        },
      });
    }
    for (const t of tasks
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .slice(0, 4)) {
      out.push({
        icon: '●',
        label: `Таймер: ${t.title}`,
        hint: projectName(t),
        act: async () => {
          close();
          await start({ task_id: t.id });
          router.push('/dashboard');
        },
      });
    }
    // Поиск по истории записей: уникальные названия, старт в один клик.
    if (q) {
      const seen = new Set<string>();
      for (const en of history) {
        if (out.length > 8) break;
        const title = en.task?.title || en.description || '';
        if (!title || seen.has(title) || !title.toLowerCase().includes(q)) continue;
        if (en.task && en.task.status === 'done') continue;
        seen.add(title);
        out.push({
          icon: '↺',
          label: `Из истории: ${title}`,
          hint: new Date(en.started_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
          }),
          act: async () => {
            close();
            await start({
              task_id: en.task_id ?? undefined,
              description: en.task_id ? undefined : (en.description ?? undefined),
            });
            router.push('/dashboard');
          },
        });
      }
    }
    if (q) {
      out.push({
        icon: '＋',
        label: `Создать задачу: «${query.trim()}»`,
        hint: '',
        act: async () => {
          close();
          await api.createTask({ title: query.trim() });
          toast('Задача создана');
          router.push('/dashboard/tasks');
        },
      });
    }
    SCREENS.forEach(([name, href], i) => {
      if (!q || name.toLowerCase().includes(q)) {
        out.push({
          icon: '→',
          label: `Перейти: ${name}`,
          hint: String(i + 1),
          act: () => {
            close();
            router.push(href);
          },
        });
      }
    });
    if (!q || 'тема'.includes(q)) {
      out.push({
        icon: '◐',
        label: 'Переключить тему',
        hint: 'T',
        act: () => {
          close();
          toggleTheme();
        },
      });
    }
    return out;
  }, [paletteOpen, query, tasks, history, start, router, toast, toggleTheme]);

  const sel = Math.min(selected, Math.max(0, items.length - 1));

  function onPaletteKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(Math.min(items.length - 1, sel + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(Math.max(0, sel - 1));
    } else if (e.key === 'Enter') {
      const it = items[sel];
      if (it) void it.act();
    } else if (sel !== 0 && e.key.length === 1) {
      setSelected(0);
    }
  }

  // Смена экрана закрывает overlays.
  useEffect(() => {
    setHelpOpen(false);
  }, [pathname]);

  return (
    <>
      {paletteOpen && (
        <div
          onClick={() => setPaletteOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 70,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxHeight: 380,
              marginTop: '12vh',
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 12,
              boxShadow: 'var(--shadow)',
              alignSelf: 'flex-start',
              overflow: 'hidden',
            }}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              onKeyDown={onPaletteKey}
              placeholder="Команда, задача или описание таймера…"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                padding: '13px 16px',
                fontSize: 14,
                color: 'var(--text)',
                outline: 'none',
              }}
            />
            <div style={{ maxHeight: 300, overflowY: 'auto', padding: 6 }}>
              {items.map((it, i) => (
                <div
                  key={`${it.icon}${it.label}`}
                  onClick={() => void it.act()}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 13,
                    background: i === sel ? 'var(--asoft)' : 'transparent',
                  }}
                >
                  <span style={{ width: 18, textAlign: 'center', color: 'var(--muted)' }}>
                    {it.icon}
                  </span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{it.hint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div
          onClick={() => setHelpOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 12,
              boxShadow: 'var(--shadow)',
              padding: '18px 20px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: 12 }}>
              Горячие клавиши
            </div>
            {HOTKEYS.map((hk) => (
              <div
                key={hk.k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '5px 0',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{hk.d}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: '11.5px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    padding: '2px 8px',
                  }}
                >
                  {hk.k}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
