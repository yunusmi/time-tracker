'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password, totpCode || undefined);
      router.replace('/dashboard');
    } catch (err) {
      // Включена 2FA — показываем поле кода вместо ошибки.
      if (err instanceof ApiError && err.message === 'totp_required') {
        setNeedTotp(true);
        setError('');
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось войти');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>Sign in</h1>
        <p className="muted">Welcome back to your time tracker.</p>
        <form onSubmit={onSubmit}>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {needTotp && (
            <div className="field">
              <label htmlFor="totp">Код из приложения-аутентификатора</label>
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
            disabled={submitting}
            style={{ width: '100%' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          No account? <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
