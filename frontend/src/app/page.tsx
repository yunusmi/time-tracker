'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

const FEATURES = [
  {
    icon: '▶',
    title: 'Трекер с таймлайном дня',
    text: 'Таймер по задаче или свободному описанию, записи тянутся мышью, idle-детект и «забытый таймер» подстрахуют вечером.',
  },
  {
    icon: '☰',
    title: 'Задачи: список и канбан',
    text: 'Приоритеты, дедлайны, оценка против факта. Шаблоны для повторяющихся дел и палитра ⌘K.',
  },
  {
    icon: '₽',
    title: 'Счета из billable-часов',
    text: 'Ставки на проект и на человека, недельные бюджеты, округление до 15/30 минут — счёт клиенту в один клик.',
  },
  {
    icon: '✓',
    title: 'Таймшиты с утверждением',
    text: 'Сотрудник отправляет неделю, админ утверждает или возвращает с причиной. Утверждённое — блокируется.',
  },
  {
    icon: '⚡',
    title: 'Стендап пишется сам',
    text: '«Что делал вчера / план на сегодня» собирается из записей — отредактируйте и отправьте в Slack или Telegram.',
  },
  {
    icon: '◫',
    title: 'Компании и роли',
    text: 'Несколько компаний на аккаунт, отделы, 5 ролей от владельца до клиента — каждый видит только своё.',
  },
];

const INTEGRATIONS = [
  'Google Calendar',
  'Slack',
  'Telegram',
  'Toggl (импорт)',
  'Clockify (импорт)',
  'API + вебхуки',
];

/** Маркетинговый лендинг (продукт бесплатный, без тарифов). */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Авторизованных сразу уводим в кабинет.
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div className="public-page" style={{ padding: 0 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '18px 24px',
          maxWidth: 1080,
          margin: '0 auto',
        }}
      >
        <Logo size={26} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>Хронос</span>
        <div style={{ flex: 1 }} />
        <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: '#3d3f47' }}>
          Войти
        </Link>
        <Link
          href="/register"
          style={{
            background: '#6366f1',
            color: '#fff',
            borderRadius: 9,
            padding: '9px 18px',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Начать бесплатно
        </Link>
      </header>

      <section
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '40px 24px 56px',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 600,
            background: '#e8e9f8',
            color: '#6366f1',
            borderRadius: 99,
            padding: '5px 14px',
            marginBottom: 18,
          }}
        >
          Полностью бесплатно — без лимитов на людей и проекты
        </span>
        <h1 style={{ fontSize: 40, lineHeight: 1.15, margin: '0 0 16px' }}>
          Время, задачи и отчёты команды — в одном месте
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: '#6b6e78',
            maxWidth: 620,
            margin: '0 auto 26px',
          }}
        >
          Трекер для агентств и команд: таймер с таймлайном дня, канбан задач,
          таймшиты с утверждением, счета из billable-часов и стендап-отчёты,
          которые пишутся сами.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/register"
            style={{
              background: '#6366f1',
              color: '#fff',
              borderRadius: 10,
              padding: '13px 26px',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Создать компанию →
          </Link>
          <Link
            href="/login"
            style={{
              background: '#fff',
              color: '#191a1f',
              border: '1px solid #d3d4dc',
              borderRadius: 10,
              padding: '13px 26px',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Войти
          </Link>
        </div>

        {/* Стилизованный мок интерфейса: активный таймер. */}
        <div
          className="public-card"
          style={{
            marginTop: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#34d399',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              API интеграции платежей
            </div>
            <div style={{ fontSize: 12, color: '#6b6e78' }}>Разработка · идёт</div>
          </div>
          <span
            className="mono"
            style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            02:41:37
          </span>
        </div>
      </section>

      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 56px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="public-card" style={{ padding: '22px 24px' }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: '#e8e9f8',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {f.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6b6e78' }}>
                {f.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '0 24px 56px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
          Работает с вашими инструментами
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {INTEGRATIONS.map((i) => (
            <span
              key={i}
              style={{
                background: '#fff',
                border: '1px solid #e4e5ea',
                borderRadius: 99,
                padding: '8px 16px',
                fontSize: 13,
                color: '#3d3f47',
              }}
            >
              {i}
            </span>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 64px' }}>
        <div className="public-card" style={{ textAlign: 'center', padding: '34px 28px' }}>
          <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
            Начните за две минуты
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: '#6b6e78',
              maxWidth: 520,
              margin: '0 auto 20px',
            }}
          >
            Компания → первый проект → приглашения. Переезжаете? Импорт из Toggl,
            Clockify и Harvest перенесёт всё автоматически.
          </div>
          <Link
            href="/register"
            style={{
              display: 'inline-block',
              background: '#6366f1',
              color: '#fff',
              borderRadius: 10,
              padding: '13px 28px',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Начать бесплатно →
          </Link>
        </div>
      </section>

      <footer
        style={{
          borderTop: '1px solid #e4e5ea',
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: 12.5,
          color: '#8b8f9a',
        }}
      >
        Хронос © {new Date().getFullYear()} · учёт времени для команд
      </footer>
    </div>
  );
}
