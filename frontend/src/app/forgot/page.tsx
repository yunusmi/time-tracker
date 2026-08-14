'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';

/** Сброс пароля, шаг 1: письмо со ссылкой (Auth Flows.dc.html). */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Ответ одинаковый независимо от наличия аккаунта — не раскрываем базу почт.
    await api.forgotPassword(email).catch(() => undefined);
    setSent(true);
    setSubmitting(false);
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
          <Logo size={24} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Хронос</span>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✉</div>
            <h1 style={{ marginBottom: 6 }}>Письмо отправлено</h1>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              Проверьте почту <b>{email}</b> — ссылка действует 1 час. По ней
              откроется форма нового пароля.
            </p>
            <Link
              href="/login"
              className="btn btn-ghost"
              style={{ marginTop: 14, display: 'inline-block' }}
            >
              ← Вернуться ко входу
            </Link>
          </div>
        ) : (
          <>
            <h1>Сброс пароля</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Пришлём письмо со ссылкой для смены пароля.
            </p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                className="btn-primary"
                type="submit"
                disabled={submitting}
                style={{ width: '100%' }}
              >
                {submitting ? 'Отправляем…' : 'Отправить письмо'}
              </button>
            </form>
            <p className="muted" style={{ marginTop: '1rem' }}>
              <Link href="/login">← Вернуться ко входу</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
