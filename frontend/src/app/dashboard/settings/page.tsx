'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AccountSection } from '@/components/settings/AccountSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { TrackingSection } from '@/components/settings/TrackingSection';
import { DataSection } from '@/components/settings/DataSection';

type SectionKey = 'account' | 'notifications' | 'tracking' | 'data';

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'account', label: 'Аккаунт', hint: 'Профиль, фото, 2FA, сессии, тема' },
  { key: 'notifications', label: 'Уведомления', hint: 'Каналы и веб-пуши' },
  { key: 'tracking', label: 'Трекинг и отчёты', hint: 'Цель, простой, точность, стендап' },
  { key: 'data', label: 'Данные и интеграции', hint: 'Компания, отделы, API, экспорт' },
];

/**
 * Настройки — отдельная страница с разделами (ТЗ «UX-правки»).
 * У клиента доступны только «Аккаунт» и «Уведомления».
 */
function SettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { isClient } = useWorkspace();

  const available = SECTIONS.filter(
    (s) => !isClient || s.key === 'account' || s.key === 'notifications',
  );

  const initial = (params.get('section') as SectionKey) ?? 'account';
  const [active, setActive] = useState<SectionKey>(initial);

  useEffect(() => {
    const fromUrl = params.get('section') as SectionKey | null;
    if (fromUrl && available.some((s) => s.key === fromUrl)) setActive(fromUrl);
  }, [params, available]);

  function select(key: SectionKey) {
    setActive(key);
    router.replace(`/dashboard/settings?section=${key}`, { scroll: false });
  }

  return (
    <div
      className="grid-reports"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 210px) 1fr',
        gap: 18,
        alignItems: 'start',
      }}
    >
      <div className="card card-pad" style={{ position: 'sticky', top: 12 }}>
        {available.map((s) => (
          <button
            key={s.key}
            onClick={() => select(s.key)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              marginBottom: 4,
              borderRadius: 8,
              border: 'none',
              background: active === s.key ? 'var(--asoft)' : 'transparent',
              color: active === s.key ? 'var(--accent)' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
              {s.label}
            </span>
            <span
              style={{ display: 'block', fontSize: '11.5px', color: 'var(--muted)' }}
            >
              {s.hint}
            </span>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 620 }}>
        {active === 'account' && <AccountSection />}
        {active === 'notifications' && <NotificationsSection />}
        {active === 'tracking' && !isClient && <TrackingSection />}
        {active === 'data' && !isClient && <DataSection />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="sk" style={{ height: 300 }} />}>
      <SettingsContent />
    </Suspense>
  );
}
