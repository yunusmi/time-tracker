'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * Мастер создания компании: название → отделы (опционально) →
 * bulk-приглашения (Auth Flows.dc.html, «Этап 2 — мультитенантность»).
 */
export default function NewWorkspacePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { refreshMe, refreshWorkspaces } = useWorkspace();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [depInput, setDepInput] = useState('');
  const [emails, setEmails] = useState('');
  const [saving, setSaving] = useState(false);

  function addDepartment() {
    const value = depInput.trim();
    if (!value || departments.includes(value)) return;
    setDepartments((prev) => [...prev, value]);
    setDepInput('');
  }

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const invites = emails
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));
      await api.createWorkspace({
        name: name.trim(),
        departments,
        invites,
      });
      await Promise.all([refreshMe(), refreshWorkspaces()]);
      toast(
        invites.length
          ? `Компания создана · приглашений: ${invites.length}`
          : 'Компания создана',
      );
      // Данные всех экранов привязаны к компании — уходим в кабинет с перезагрузкой.
      window.location.href = '/dashboard';
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : 'Не удалось создать компанию',
      );
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: step >= n ? 'var(--accent)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      <div className="card card-pad">
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Новая компания</h2>
            <p className="muted" style={{ fontSize: '12.5px', marginBottom: 16 }}>
              Компания — изолированное пространство: свои проекты, сотрудники,
              задачи и отчёты.
            </p>
            <div className="field">
              <label>Название компании</label>
              <input
                className="input"
                autoFocus
                value={name}
                placeholder="Cherrypick Agency"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) setStep(2);
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => router.back()}>
                Отмена
              </button>
              <button
                className="btn btn-accent"
                disabled={!name.trim()}
                onClick={() => setStep(2)}
              >
                Далее
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Отделы</h2>
            <p className="muted" style={{ fontSize: '12.5px', marginBottom: 16 }}>
              Необязательно. Отделы группируют сотрудников — по ним фильтруется
              «Команда».
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                className="input"
                value={depInput}
                placeholder="Например, Разработка"
                onChange={(e) => setDepInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addDepartment();
                }}
              />
              <button className="btn btn-outline" onClick={addDepartment}>
                + Добавить
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 18,
                minHeight: 28,
              }}
            >
              {departments.map((d) => (
                <button
                  key={d}
                  className="chip on"
                  onClick={() =>
                    setDepartments((prev) => prev.filter((x) => x !== d))
                  }
                  title="Убрать"
                >
                  {d} ✕
                </button>
              ))}
              {departments.length === 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  Отделы не заданы — можно добавить позже в настройках
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                Назад
              </button>
              <button className="btn btn-accent" onClick={() => setStep(3)}>
                Далее
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Приглашения</h2>
            <p className="muted" style={{ fontSize: '12.5px', marginBottom: 16 }}>
              Впишите email через запятую или с новой строки — каждому уйдёт
              письмо с приглашением (роль «Участник», меняется в «Команде»).
            </p>
            <textarea
              className="input"
              rows={4}
              value={emails}
              placeholder={'anya@example.com\nmark@example.com'}
              onChange={(e) => setEmails(e.target.value)}
              style={{ marginBottom: 18, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                Назад
              </button>
              <button
                className="btn btn-accent"
                disabled={saving}
                onClick={() => void create()}
              >
                {saving ? 'Создаём…' : 'Создать компанию'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
