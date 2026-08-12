'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import type { WorkspaceInvite, WorkspaceMemberView, WorkspaceRole } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  member: 'Участник',
};

const MEMBERS_POLL_MS = 30_000;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function memberCountLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} участника`;
  return `${n} участников`;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<WorkspaceMemberView[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');

  const me = members.find((m) => m.user_id === user?.id);
  const canInvite = me ? me.role !== 'member' : false;

  const load = useCallback(async () => {
    try {
      const [m, iv] = await Promise.all([
        api.getWorkspaceMembers(),
        api.listWorkspaceInvites().catch(() => [] as WorkspaceInvite[]),
      ]);
      setMembers(m);
      setInvites(iv.filter((i) => i.email)); // ссылка-приглашение (email='') не показывается в списке
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить команду');
    }
  }, []);

  // Live-статус: обновляем список раз в 30 секунд.
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), MEMBERS_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email.includes('@')) {
      toast('Укажите корректный email');
      return;
    }
    try {
      await api.sendWorkspaceInvite({ email, role: inviteRole });
      setInviteEmail('');
      toast('Приглашение отправлено');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось отправить приглашение');
    }
  }

  async function copyInviteLink() {
    try {
      const { token } = await api.getInviteLink();
      const url = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(url);
      toast('Ссылка-приглашение скопирована');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось получить ссылку');
    }
  }

  async function revoke(id: string) {
    try {
      await api.revokeWorkspaceInvite(id);
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось отозвать приглашение');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          {memberCountLabel(members.length)}
        </span>
        <div style={{ flex: 1 }} />
        {canInvite && (
          <button
            className="btn btn-accent"
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setInviteOpen((o) => !o)}
          >
            + Пригласить
          </button>
        )}
      </div>

      {inviteOpen && (
        <div
          className="card"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            borderColor: 'var(--accent)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <input
            className="input input-sm"
            placeholder="email коллеги"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void sendInvite();
            }}
            style={{ flex: 1 }}
          />
          <div className="seg seg-flat">
            <button
              className={inviteRole === 'member' ? 'on' : ''}
              style={{ padding: '6px 14px' }}
              onClick={() => setInviteRole('member')}
            >
              Участник
            </button>
            <button
              className={inviteRole === 'admin' ? 'on' : ''}
              style={{ padding: '6px 14px' }}
              onClick={() => setInviteRole('admin')}
            >
              Админ
            </button>
          </div>
          <button
            className="btn btn-accent"
            style={{ borderRadius: 7, padding: '8px 16px', fontSize: 13 }}
            onClick={() => void sendInvite()}
          >
            Отправить
          </button>
          <button
            className="btn-outline"
            style={{ padding: '8px 14px', fontSize: 13 }}
            onClick={() => void copyInviteLink()}
          >
            Копировать ссылку
          </button>
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
          className="stat-title"
        >
          <span style={{ flex: 1.6 }}>Участник</span>
          <span style={{ width: 80 }}>Роль</span>
          <span style={{ flex: 2 }}>Сейчас</span>
          <span style={{ width: 90, textAlign: 'right' }}>Сегодня</span>
          <span style={{ width: 90, textAlign: 'right' }}>Неделя</span>
        </div>

        {members.map((m) => {
          const online = !!m.active_task_title;
          return (
            <div
              key={m.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--asoft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials(m.name)}
                </div>
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                {m.user_id === user?.id && <span className="chip-badge">вы</span>}
              </div>
              <span style={{ width: 80, fontSize: '11.5px', color: 'var(--muted)' }}>
                {ROLE_LABEL[m.role]}
              </span>
              <div
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '12.5px',
                  color: online ? 'var(--text)' : 'var(--muted)',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: online ? 'var(--green)' : 'var(--border2)',
                    flexShrink: 0,
                  }}
                />
                {online ? `Трекает «${m.active_task_title}»` : 'Не в сети'}
              </div>
              <span className="mono" style={{ width: 90, textAlign: 'right', fontSize: '12.5px' }}>
                {m.today_seconds ? formatHM(m.today_seconds) : '—'}
              </span>
              <span
                className="mono"
                style={{ width: 90, textAlign: 'right', fontSize: '12.5px', color: 'var(--muted)' }}
              >
                {m.week_seconds ? formatHM(m.week_seconds) : '—'}
              </span>
            </div>
          );
        })}

        {invites.map((iv) => (
          <div
            key={iv.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: '12.5px',
            }}
          >
            <span style={{ color: 'var(--muted)' }}>✉</span>
            <span style={{ fontWeight: 500 }}>{iv.email}</span>
            <span className="chip-badge">{ROLE_LABEL[iv.role]}</span>
            <span style={{ color: 'var(--muted)' }}>приглашение отправлено</span>
            <div style={{ flex: 1 }} />
            {canInvite && (
              <button
                onClick={() => void revoke(iv.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  borderRadius: 5,
                  padding: '2px 6px',
                }}
              >
                Отозвать
              </button>
            )}
          </div>
        ))}

        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)' }}>
          Участники видят агрегаты времени друг друга; приглашать может админ и владелец.
        </div>
      </div>
    </div>
  );
}
