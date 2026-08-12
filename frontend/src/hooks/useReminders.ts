'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { notify, onceToday } from '@/lib/notify';
import { useSettings } from '@/context/SettingsContext';
import { useTimer } from '@/context/TimerContext';

const DAY_START_KEY = 'tt_notified_day_start';
const GOAL_KEY = 'tt_notified_goal';

/**
 * Напоминания из настроек:
 * — «начать трекинг в начале дня»: при открытии приложения, если сегодня
 *   ещё ничего не затрекано и таймер не идёт;
 * — «цель дня достигнута»: когда суммарное время за день пересекает цель.
 */
export function useReminders(todaySeconds?: number) {
  const { settings } = useSettings();
  const { active } = useTimer();
  const checkedDayStart = useRef(false);

  // Напоминание начать день — один раз за визит и не чаще раза в день.
  useEffect(() => {
    if (checkedDayStart.current || !settings.notify_day_start) return;
    checkedDayStart.current = true;
    if (active) return;
    api
      .listEntries(todayIso())
      .then((entries) => {
        if (entries.length === 0 && onceToday(DAY_START_KEY)) {
          notify('Хронос', 'Не забудьте начать трекинг времени.');
        }
      })
      .catch(() => undefined);
  }, [settings.notify_day_start, active]);

  // Цель дня достигнута.
  useEffect(() => {
    if (!settings.notify_goal_reached || todaySeconds === undefined) return;
    if (todaySeconds >= settings.daily_goal_hours * 3600 && onceToday(GOAL_KEY)) {
      notify('Хронос', `Цель дня достигнута — ${settings.daily_goal_hours}ч затрекано! 🎉`);
    }
  }, [todaySeconds, settings.notify_goal_reached, settings.daily_goal_hours]);
}
