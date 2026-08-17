'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Фирменная «G» Google (четырёхцветная). */
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Знак Яндекса. */
function YandexIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
      <path
        fill="#fff"
        d="M13.32 7.15h-1.14c-1.87 0-2.83.95-2.83 2.36 0 1.58.66 2.32 2.05 3.26l1.12.76-3.22 4.9H6.9l2.94-4.38c-1.69-1.21-2.64-2.39-2.64-4.38 0-2.5 1.74-4.2 5-4.2h3.09v13.68h-1.97V7.15z"
      />
    </svg>
  );
}

/**
 * Кнопки SSO «Google / Яндекс» для входа и регистрации (Auth Flows.dc.html).
 * Показываются только настроенные на сервере провайдеры; если ни один не
 * настроен — блок не рендерится вовсе.
 */
export function SsoButtons({ divider = 'или по почте' }: { divider?: string }) {
  const [providers, setProviders] = useState<{
    google: boolean;
    yandex: boolean;
  } | null>(null);

  useEffect(() => {
    api
      .oauthProviders()
      .then(setProviders)
      .catch(() => setProviders(null));
  }, []);

  if (!providers || (!providers.google && !providers.yandex)) return null;

  const buttonStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--text)',
    textDecoration: 'none',
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {providers.google && (
          <a href={api.oauthStartUrl('google')} style={buttonStyle}>
            <GoogleIcon />
            Google
          </a>
        )}
        {providers.yandex && (
          <a href={api.oauthStartUrl('yandex')} style={buttonStyle}>
            <YandexIcon />
            Яндекс
          </a>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          margin: '0 0 14px',
          color: 'var(--muted)',
          fontSize: 12,
        }}
      >
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {divider}
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
    </>
  );
}
