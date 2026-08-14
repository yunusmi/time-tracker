'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { SsoButtons } from '@/components/SsoButtons';

type Kind = 'team' | 'solo';
type Step = 'kind' | 'account' | 'company' | 'project' | 'invites' | 'done';

/**
 * Регистрация по макету Auth Flows.dc.html: выбор «команда / для себя» →
 * аккаунт → (для команды) компания → первый проект → приглашения → финал.
 */
export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('kind');
  const [kind, setKind] = useState<Kind>('team');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [project, setProject] = useState('');
  const [invites, setInvites] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Уже авторизован и мастер не запущен — уводим в кабинет.
    if (!loading && user && step === 'kind') router.replace('/dashboard');
  }, [user, loading, router, step]);

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, name, password);
      setStep(kind === 'team' ? 'company' : 'project');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать аккаунт');
    } finally {
      setSubmitting(false);
    }
  }

  /** Компания создаётся отдельным шагом: владелец = текущий пользователь. */
  async function createCompany() {
    if (!company.trim()) return;
    setSubmitting(true);
    try {
      await api.createWorkspace({ name: company.trim() });
      setStep('project');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать компанию');
    } finally {
      setSubmitting(false);
    }
  }

  async function createProject() {
    setSubmitting(true);
    try {
      if (project.trim()) await api.createProject({ name: project.trim() });
      setStep(kind === 'team' ? 'invites' : 'done');
    } catch {
      setStep(kind === 'team' ? 'invites' : 'done');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendInvites() {
    setSubmitting(true);
    const emails = invites
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));
    if (emails.length) {
      await api.bulkInvite(emails).catch(() => undefined);
    }
    setSubmitting(false);
    setStep('done');
  }

  const stepIndex = ['kind', 'account', 'company', 'project', 'invites'].indexOf(
    step,
  );

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
          <Logo size={24} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Хронос</span>
        </div>

        {step !== 'done' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {[0, 1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 99,
                  background: n <= stepIndex ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {step === 'kind' && (
          <>
            <h1>Как будете использовать Хронос?</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Это определит первый шаг — изменить можно всегда.
            </p>
            {(
              [
                {
                  key: 'team' as Kind,
                  title: 'Для команды или агентства',
                  text: 'Вы владелец: создадите компанию, пригласите сотрудников, увидите отчёты всех и счета.',
                },
                {
                  key: 'solo' as Kind,
                  title: 'Для себя',
                  text: 'Фриланс или личный учёт: свои проекты, время и отчёты. Команду можно добавить позже.',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setKind(opt.key)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: `1px solid ${kind === opt.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: kind === opt.key ? 'var(--asoft)' : 'var(--surface2)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 10,
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{opt.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {opt.text}
                </div>
              </button>
            ))}
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 6 }}
              onClick={() => setStep('account')}
            >
              Продолжить
            </button>
            <p className="muted" style={{ marginTop: '1rem' }}>
              Уже есть аккаунт? <Link href="/login">Войти</Link>
            </p>
          </>
        )}

        {step === 'account' && (
          <>
            <h1>Создание аккаунта</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              {kind === 'team' ? 'Для команды' : 'Для себя'} · на почту придёт
              письмо для подтверждения.
            </p>
            <SsoButtons divider="или вручную" />
            <form onSubmit={createAccount}>
              <div className="field">
                <label htmlFor="name">Имя</label>
                <input
                  id="name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
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
                <label htmlFor="password">Пароль (мин. 8 символов)</label>
                <input
                  id="password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                {submitting ? 'Создаём…' : 'Создать аккаунт'}
              </button>
            </form>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => setStep('kind')}
            >
              ← Назад
            </button>
          </>
        )}

        {step === 'company' && (
          <>
            <h1>Как называется компания?</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Отдельное пространство: свои проекты, сотрудники и отчёты. Позже
              сможете создать ещё.
            </p>
            <div className="field">
              <label htmlFor="company">Название</label>
              <input
                id="company"
                autoFocus
                value={company}
                placeholder="Cherrypick Agency"
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createCompany();
                }}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={!company.trim() || submitting}
              onClick={() => void createCompany()}
            >
              Далее
            </button>
          </>
        )}

        {step === 'project' && (
          <>
            <h1>Первый проект</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Время всегда трекается в проект — создадим первый сразу. Ставку и
              бюджет добавите позже.
            </p>
            <div className="field">
              <label htmlFor="project">Название проекта</label>
              <input
                id="project"
                autoFocus
                value={project}
                placeholder="Разработка"
                onChange={(e) => setProject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createProject();
                }}
              />
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={submitting}
              onClick={() => void createProject()}
            >
              {project.trim() ? 'Создать и продолжить' : 'Пропустить'}
            </button>
          </>
        )}

        {step === 'invites' && (
          <>
            <h1>Пригласите команду</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Email через запятую — каждому уйдёт письмо. Роли назначите в
              «Команде». Можно пропустить.
            </p>
            <textarea
              className="input"
              rows={3}
              value={invites}
              placeholder={'anya@example.com, mark@example.com'}
              onChange={(e) => setInvites(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 14,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={submitting}
              onClick={() => void sendInvites()}
            >
              {invites.trim() ? 'Отправить приглашения' : 'Пропустить'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'var(--gsoft)',
                color: 'var(--green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                margin: '0 auto 14px',
              }}
            >
              ✓
            </div>
            <h1 style={{ marginBottom: 6 }}>Всё готово</h1>
            <p className="muted" style={{ lineHeight: 1.6, marginBottom: 16 }}>
              {kind === 'team'
                ? 'Компания создана — можно ставить задачи и трекать время.'
                : 'Пространство готово — можно запускать первый таймер.'}
            </p>
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={() => router.replace('/dashboard')}
            >
              Войти в кабинет →
            </button>
            <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
              В кабинете вас встретит короткий тур по разделам.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
