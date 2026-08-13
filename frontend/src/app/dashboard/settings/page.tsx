'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { AccountCard } from '@/components/AccountCard';
import { ROLE_LABEL, useWorkspace } from '@/context/WorkspaceContext';

const ROLE_HINT: Record<string, string> = {
  owner: 'Полный доступ, включая управление командой и ролями.',
  admin: 'Проекты, приглашения, задачи и отчёты всей команды.',
  pm: 'Задачи и отчёты только своего проекта, без денежных сумм.',
  member: 'Только свои задачи, записи и отчёты.',
  client: 'Только отчёты своего проекта, read-only.',
};

const INTEGRATIONS = [
  { k: 'gcal', ini: 'G', name: 'Google Calendar', desc: 'Записи времени — событиями в календаре' },
  { k: 'slack', ini: 'S', name: 'Slack', desc: 'Дайджест дня и команда /track' },
  { k: 'tg', ini: 'T', name: 'Telegram', desc: 'Напоминания и быстрый старт таймера' },
] as const;

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { role, me } = useWorkspace();

  // Интеграции — демо-переключатели (OAuth-флоу и вебхуки — отдельный этап).
  const [integr, setIntegr] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setIntegr(JSON.parse(window.localStorage.getItem('tt_integrations') ?? '{}'));
    } catch {
      /* ignore */
    }
  }, []);

  function toggleIntegration(k: string) {
    const next = { ...integr, [k]: !integr[k] };
    setIntegr(next);
    window.localStorage.setItem('tt_integrations', JSON.stringify(next));
    toast(next[k] ? 'Интеграция подключена (демо)' : 'Интеграция отключена');
  }

  function toggleNotify(
    key: 'notify_day_start' | 'notify_goal_reached',
    on: boolean,
  ) {
    updateSettings({ [key]: on });
    if (on && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    if (on && 'Notification' in window && Notification.permission === 'denied') {
      toast('Уведомления заблокированы в настройках браузера');
    }
  }

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <AccountCard />

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Роль в команде</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          {me?.workspace_name ? `Команда «${me.workspace_name}». ` : ''}
          Роль назначает владелец или админ команды.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              padding: '4px 12px',
              background: 'var(--asoft)',
              color: 'var(--accent)',
            }}
          >
            {ROLE_LABEL[role]}
          </span>
          <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{ROLE_HINT[role]}</span>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Цель дня</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Сколько часов в день хотите трекать. Прогресс виден на главном экране.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={1}
            max={12}
            value={settings.daily_goal_hours}
            onChange={(e) => updateSettings({ daily_goal_hours: Number(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span className="mono" style={{ fontWeight: 600, width: 36 }}>
            {settings.daily_goal_hours}ч
          </span>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Контроль простоя</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Если таймер идёт, а активности нет — предложим вычесть простой.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={1}
            max={30}
            value={settings.idle_threshold_minutes}
            onChange={(e) =>
              updateSettings({ idle_threshold_minutes: Number(e.target.value) })
            }
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span className="mono" style={{ fontWeight: 600, width: 52 }}>
            {settings.idle_threshold_minutes} мин
          </span>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={settings.auto_stop_evening}
            onChange={(e) => updateSettings({ auto_stop_evening: e.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          Авто-стоп таймера в 19:00 при отсутствии активности
        </label>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Помощь</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn-outline"
            style={{ padding: '7px 14px' }}
            onClick={() => window.dispatchEvent(new Event('tt-open-tour'))}
          >
            Тур по интерфейсу
          </button>
          <button
            className="btn-outline"
            style={{ padding: '7px 14px' }}
            onClick={() => window.dispatchEvent(new Event('tt-open-help'))}
          >
            Горячие клавиши (?)
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Напоминания</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Браузерные уведомления.
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
            onChange={(e) => toggleNotify('notify_day_start', e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Напомнить начать трекинг в начале дня
        </label>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={settings.notify_goal_reached}
            onChange={(e) => toggleNotify('notify_goal_reached', e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Сообщить, когда цель дня достигнута
        </label>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Интеграции</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 8 }}>
          Синхронизация и уведомления (пока демо — OAuth-подключение появится позже).
        </div>
        {INTEGRATIONS.map((ig) => {
          const on = !!integr[ig.k];
          return (
            <div
              key={ig.k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--accent)',
                }}
              >
                {ig.ini}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ig.name}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{ig.desc}</div>
              </div>
              <button
                onClick={() => toggleIntegration(ig.k)}
                style={{
                  background: on ? 'transparent' : 'var(--accent)',
                  color: on ? 'var(--muted)' : '#fff',
                  border: `1px solid ${on ? 'var(--border2)' : 'var(--accent)'}`,
                  borderRadius: 7,
                  padding: '5px 12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {on ? 'Отключить' : 'Подключить'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Тема</div>
        <div className="seg seg-flat" style={{ display: 'inline-flex' }}>
          <button
            className={theme === 'dark' ? 'on' : ''}
            style={{ padding: '6px 18px' }}
            onClick={() => setTheme('dark')}
          >
            Тёмная
          </button>
          <button
            className={theme === 'light' ? 'on' : ''}
            style={{ padding: '6px 18px' }}
            onClick={() => setTheme('light')}
          >
            Светлая
          </button>
        </div>
      </div>
    </div>
  );
}
