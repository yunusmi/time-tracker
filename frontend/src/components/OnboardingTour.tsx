'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';

const TOUR_SEEN_KEY = 'tt_tour_seen';

const STEPS = [
  {
    title: 'Проекты и задачи',
    text: 'Создайте проект с цветом и ставьте задачи с оценкой, приоритетом и дедлайном. Админ назначает задачи коллегам.',
  },
  {
    title: 'Трекер времени',
    text: 'Запускайте таймер по задаче или простым описанием (Enter). День виден на таймлайне — записи можно тянуть мышью, редактировать кликом или добавлять вручную.',
  },
  {
    title: 'Отчёты и таймшиты',
    text: 'Неделя — графиком или календарём, разбивка по проектам и суммы. В конце недели отправьте таймшит на проверку — админ утвердит или вернёт с комментарием.',
  },
];

/** Тур из 3 шагов; авто-показ при первом входе, повтор — событием tt-open-tour. */
export function OnboardingTour() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!window.localStorage.getItem(TOUR_SEEN_KEY)) {
      setOpen(true);
      setStep(0);
    }
    const onOpen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('tt-open-tour', onOpen);
    return () => window.removeEventListener('tt-open-tour', onOpen);
  }, []);

  function close(finished: boolean) {
    setOpen(false);
    window.localStorage.setItem(TOUR_SEEN_KEY, '1');
    if (finished) toast('Тур завершён — приятной работы!');
  }

  if (!open) return null;
  const s = STEPS[step];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        zIndex: 75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 420,
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 12,
          boxShadow: 'var(--shadow)',
          padding: '22px 24px',
        }}
      >
        <div style={{ fontSize: '11.5px', color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
          Шаг {step + 1} из {STEPS.length}
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{s.title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 18 }}>
          {s.text}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => close(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '12.5px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Пропустить
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button
              className="btn-outline"
              style={{ padding: '7px 14px' }}
              onClick={() => setStep((v) => Math.max(0, v - 1))}
            >
              Назад
            </button>
          )}
          <button
            className="btn btn-accent"
            style={{ borderRadius: 7, padding: '7px 18px', fontSize: '12.5px' }}
            onClick={() => {
              if (step < STEPS.length - 1) setStep(step + 1);
              else close(true);
            }}
          >
            {step === STEPS.length - 1 ? 'Готово' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
}
