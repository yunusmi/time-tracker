'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, setToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

/** Сброс пароля, шаг 2: новый пароль по токену из письма. */
function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Минимум 8 символов');
      return;
    }
    if (password !== repeat) {
      setError('Пароли не совпадают');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.resetPassword(token, password);
      setToken(res.access_token);
      await refresh();
      router.replace('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось сменить пароль',
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="card auth-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
        <Logo size={24} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Хронос</span>
      </div>
      <h1>Новый пароль</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Минимум 8 символов. Прежние сессии на других устройствах будут завершены.
      </p>
      {!token ? (
        <>
          <p className="error">Ссылка неполная — токен не найден.</p>
          <Link href="/forgot" className="btn btn-ghost">
            Запросить новую ссылку
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="pass">Пароль</label>
            <input
              id="pass"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="repeat">Повторите пароль</label>
            <input
              id="repeat"
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button
            className="btn-primary"
            type="submit"
            disabled={submitting}
            style={{ width: '100%' }}
          >
            {submitting ? 'Сохраняем…' : 'Сохранить и войти'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-wrap">
      <Suspense fallback={<div className="sk" style={{ width: 380, height: 280 }} />}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
