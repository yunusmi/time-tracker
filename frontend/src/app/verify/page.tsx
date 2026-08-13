'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState('error');
      setMessage('В ссылке нет токена подтверждения.');
      return;
    }
    api
      .verifyEmail(token)
      .then((res) => {
        setState('ok');
        setMessage(res.email);
      })
      .catch((err) => {
        setState('error');
        setMessage(
          err instanceof ApiError ? err.message : 'Не удалось подтвердить почту',
        );
      });
  }, [token]);

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {state === 'pending' && <p className="muted">Подтверждаем почту…</p>}
        {state === 'ok' && (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
            <h1>Почта подтверждена</h1>
            <p className="muted">
              Адрес <b>{message}</b> подтверждён — все возможности аккаунта открыты.
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link href="/dashboard">Перейти в Хронос →</Link>
            </p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1>Не получилось</h1>
            <p className="error">{message}</p>
            <p className="muted" style={{ fontSize: '12.5px' }}>
              Запросите новое письмо в Настройках → Аккаунт.
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link href="/dashboard/settings">В настройки</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-wrap">
          <p className="muted">Загрузка…</p>
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
