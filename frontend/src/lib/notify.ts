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

/**
 * Короткий звуковой сигнал через WebAudio — по завершении фазы Pomodoro.
 * Не требует файлов и не падает, если аудио недоступно.
 */
export function chime(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Две ноты: «дин-дон».
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.24);
    });
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* звук не критичен */
  }
}
