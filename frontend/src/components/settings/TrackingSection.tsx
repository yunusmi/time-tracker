'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';

const ROUNDINGS = [0, 15, 30];

/** Настройки → Трекинг и отчёты: цель, простой, точность, стендап. */
export function TrackingSection() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { me, isAdmin, refreshMe } = useWorkspace();

  const [suGreet, setSuGreet] = useState('');
  const [suMisc, setSuMisc] = useState('');
  const [suSign, setSuSign] = useState('');

  useEffect(() => {
    setSuGreet(settings.standup_greeting);
    setSuMisc(settings.standup_misc_line);
    setSuSign(settings.standup_signature);
  }, [
    settings.standup_greeting,
    settings.standup_misc_line,
    settings.standup_signature,
  ]);

  function saveStandupField(
    key: 'standup_greeting' | 'standup_misc_line' | 'standup_signature',
    value: string,
  ) {
    if (settings[key] === value) return;
    updateSettings({ [key]: value });
    toast('Шаблон стендапа сохранён');
  }

  async function saveWorkspace(patch: {
    rounding_minutes?: number;
    day_norm_hours?: number;
  }) {
    try {
      await api.updateWorkspace(patch);
      await refreshMe();
      toast('Настройки компании сохранены');
    } catch {
      toast('Не удалось сохранить — попробуйте ещё раз');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Цель дня</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Сколько часов в день хотите трекать. Прогресс виден в Трекере, серия
          целей — в Отчётах.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={1}
            max={12}
            value={settings.daily_goal_hours}
            onChange={(e) =>
              updateSettings({ daily_goal_hours: Number(e.target.value) })
            }
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span className="mono" style={{ fontWeight: 600, width: 36 }}>
            {settings.daily_goal_hours}ч
          </span>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Контроль простоя
        </div>
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
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Точность времени
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Округление часов в клиентских отчётах и счетах.
          {!isAdmin && ' Настраивает админ компании.'}
        </div>
        <div className="seg seg-flat" style={{ display: 'inline-flex' }}>
          {ROUNDINGS.map((r) => (
            <button
              key={r}
              className={(me?.rounding_minutes ?? 0) === r ? 'on' : ''}
              disabled={!isAdmin}
              style={{ padding: '6px 16px' }}
              onClick={() => void saveWorkspace({ rounding_minutes: r })}
            >
              {r === 0 ? 'Без округления' : `До ${r} мин`}
            </button>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Норма часов в день
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Используется для загрузки недели, недобора и пересчёта оклада в
          часовую ставку.{!isAdmin && ' Настраивает админ компании.'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={1}
            max={12}
            disabled={!isAdmin}
            value={me?.day_norm_hours ?? 8}
            onChange={(e) =>
              void saveWorkspace({ day_norm_hours: Number(e.target.value) })
            }
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span className="mono" style={{ fontWeight: 600, width: 36 }}>
            {me?.day_norm_hours ?? 8}ч
          </span>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Месячный лимит часов
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Строка «Отработано / Осталось» в стендап-отчёте.
        </div>
        <input
          className="input input-sm"
          type="number"
          min={1}
          max={400}
          value={settings.monthly_hours_limit}
          onChange={(e) =>
            updateSettings({ monthly_hours_limit: Number(e.target.value) || 1 })
          }
          style={{ width: 120 }}
        />
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Стендап-отчёт
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Свой шаблон текста; авто-отправка использует подключённые интеграции.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
              Приветствие
            </div>
            <input
              className="input input-sm"
              style={{ width: '100%' }}
              value={suGreet}
              onChange={(e) => setSuGreet(e.target.value)}
              onBlur={() => saveStandupField('standup_greeting', suGreet)}
            />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
              Строка активностей
            </div>
            <input
              className="input input-sm"
              style={{ width: '100%' }}
              value={suMisc}
              onChange={(e) => setSuMisc(e.target.value)}
              onBlur={() => saveStandupField('standup_misc_line', suMisc)}
            />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
            Подпись (необязательно)
          </div>
          <input
            className="input input-sm"
            style={{ width: '100%' }}
            placeholder="например: Хорошего дня!"
            value={suSign}
            onChange={(e) => setSuSign(e.target.value)}
            onBlur={() => saveStandupField('standup_signature', suSign)}
          />
        </div>
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
            checked={settings.standup_auto_send}
            onChange={(e) => {
              updateSettings({ standup_auto_send: e.target.checked });
              toast(
                e.target.checked
                  ? 'Авто-отправка стендапа включена (будни, 10:00)'
                  : 'Авто-отправка стендапа выключена',
              );
            }}
            style={{ accentColor: 'var(--accent)' }}
          />
          Отправлять автоматически в 10:00 (Slack/Telegram)
        </label>
      </div>
    </div>
  );
}
