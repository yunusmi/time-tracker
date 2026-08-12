'use client';

import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

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
