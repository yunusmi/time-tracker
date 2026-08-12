/** Показывает браузерное уведомление, если разрешение выдано. */
export function notify(title: string, body?: string): void {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, body ? { body } : undefined);
  }
}

/** true — если сегодня это уведомление ещё не показывали (и помечает как показанное). */
export function onceToday(key: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const stored = window.localStorage.getItem(key);
  if (stored === today) return false;
  window.localStorage.setItem(key, today);
  return true;
}
