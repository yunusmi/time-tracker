'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError, setToken } from '@/lib/api';
import { Logo } from '@/components/Logo';

type Mode = 'password' | 'magic-sent' | 'totp';

function LoginForm() {
  const { login, user, loading, refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mode, setMode] = useState<Mode>('password');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Капча появляется после 2 неудачных попыток (ТЗ Auth 2.0).
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [captchaChecked, setCaptchaChecked] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  // Вход по ссылке из письма: /login?magic=<token>.
  useEffect(() => {
    const token = params.get('magic');
    if (!token) return;
    api
      .magicLogin(token)
      .then(async (res) => {
        setToken(res.access_token);
        await refresh();
        router.replace('/dashboard');
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : 'Ссылка недействительна',
        ),
      );
  }, [params, refresh, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(
        email,
        password,
        totpCode || undefined,
        captchaNeeded && captchaChecked ? 'human' : undefined,
      );
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.message === 'totp_required') {
        setMode('totp');
        setError('');
      } else if (err instanceof ApiError && err.message === 'captcha_required') {
        setCaptchaNeeded(true);
        setError('Подтвердите, что вы не робот');
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось войти');
        // После неудачи спрашиваем сервер, нужна ли теперь капча.
        api
          .captchaRequired(email)
          .then((r) => setCaptchaNeeded(r.required))
          .catch(() => undefined);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function sendMagicLink() {
    if (!email.includes('@')) {
      setError('Укажите email — на него придёт ссылка для входа');
      return;
    }
    setError('');
    await api.sendMagicLink(email).catch(() => undefined);
    setMode('magic-sent');
  }

  if (mode === 'magic-sent') {
    return (
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>✉</div>
        <h1 style={{ marginBottom: 6 }}>Ссылка отправлена</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Письмо ушло на <b>{email}</b> — ссылка действует 15 минут и работает
          один раз.
        </p>
        <button
          className="btn btn-ghost"
          style={{ marginTop: 14 }}
          onClick={() => setMode('password')}
        >
          ← Вернуться ко входу
        </button>
      </div>
    );
  }

  return (
    <div className="card auth-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 16,
        }}
      >
        <Logo size={24} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Хронос</span>
      </div>
      <h1>С возвращением</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        {mode === 'totp'
          ? 'Введите код из приложения-аутентификатора (2FA включена)'
          : 'Войдите, чтобы продолжить'}
      </p>

      <form onSubmit={onSubmit}>
        {mode === 'password' && (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Link
                href="/forgot"
                style={{ fontSize: 12, color: 'var(--accent)' }}
              >
                Забыли пароль?
              </Link>
            </div>
            {captchaNeeded && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  border: '1px solid var(--border2)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: '0.9rem',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={captchaChecked}
                  onChange={(e) => setCaptchaChecked(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Я не робот
                <span
                  style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}
                >
                  после 2 неудачных попыток
                </span>
              </label>
            )}
          </>
        )}

        {mode === 'totp' && (
          <div className="field">
            <label htmlFor="totp">Код 2FA</label>
            <input
              id="totp"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              style={{ letterSpacing: '0.3em', textAlign: 'center' }}
            />
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <button
          className="btn-primary"
          type="submit"
          disabled={submitting || (captchaNeeded && !captchaChecked)}
          style={{ width: '100%' }}
        >
          {submitting ? 'Входим…' : mode === 'totp' ? 'Подтвердить' : 'Войти'}
        </button>
      </form>

      {mode === 'password' && (
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => void sendMagicLink()}
        >
          Войти по ссылке из письма — без пароля
        </button>
      )}

      <p className="muted" style={{ marginTop: '1rem' }}>
        Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-wrap">
      <Suspense fallback={<div className="sk" style={{ width: 380, height: 320 }} />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
