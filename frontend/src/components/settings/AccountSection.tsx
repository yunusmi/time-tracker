'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, clearToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTheme } from '@/context/ThemeContext';
import { ROLE_LABEL, useWorkspace } from '@/context/WorkspaceContext';
import { AccountCard } from '@/components/AccountCard';
import { Avatar } from '@/components/Logo';
import { useConfirm } from '@/components/ConfirmDialog';
import { SkeletonRows } from '@/components/Skeleton';
import { cropToSquareDataUrl } from '@/lib/image';
import type { SessionView } from '@/lib/types';

const ROLE_HINT: Record<string, string> = {
  owner: 'Полный доступ, включая управление командой и ролями.',
  admin: 'Проекты, приглашения, задачи и отчёты всей команды.',
  pm: 'Задачи и отчёты только своего проекта, без денежных сумм.',
  member: 'Только свои задачи, записи и отчёты.',
  client: 'Только отчёты своего проекта, read-only.',
};

/** Настройки → Аккаунт: фото, профиль, 2FA, сессии, роль, тема, помощь. */
export function AccountSection() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const { mode, setMode } = useTheme();
  const { role, me } = useWorkspace();
  const { confirm, dialog } = useConfirm();

  const fileRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<SessionView[] | null>(null);

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  async function onAvatarPick(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await cropToSquareDataUrl(file, 128);
      const updated = await api.updateAvatar(dataUrl);
      setUser(updated);
      toast('Фото профиля обновлено');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось загрузить фото');
    }
  }

  async function removeAvatar() {
    try {
      const updated = await api.updateAvatar(null);
      setUser(updated);
      toast('Фото удалено — показываются инициалы');
    } catch {
      toast('Не удалось удалить фото');
    }
  }

  async function revokeAll() {
    const ok = await confirm({
      title: 'Выйти на всех устройствах?',
      description:
        'Все сессии, кроме текущей, будут завершены. На других устройствах потребуется войти заново.',
      confirmLabel: 'Выйти везде',
    });
    if (!ok) return;
    await api.revokeAllSessions().catch(() => undefined);
    setSessions(await api.listSessions().catch(() => []));
    toast('Остальные сессии завершены');
  }

  async function revokeOne(s: SessionView) {
    if (s.current) {
      const ok = await confirm({
        title: 'Завершить текущую сессию?',
        description: 'Вы выйдете из аккаунта на этом устройстве.',
        confirmLabel: 'Выйти',
      });
      if (!ok) return;
      await api.revokeSession(s.id).catch(() => undefined);
      clearToken();
      window.location.href = '/login';
      return;
    }
    await api.revokeSession(s.id).catch(() => undefined);
    setSessions((prev) => (prev ?? []).filter((x) => x.id !== s.id));
    toast('Сессия завершена');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dialog}

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Фото профиля</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={user?.name ?? ''} src={user?.avatar_url} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.55 }}>
              PNG или JPG, квадрат от 128px. Обрежем по центру и покажем кругом —
              в сайдбаре, «Команде» и профиле. Без фото показываются инициалы.
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => void onAvatarPick(e.target.files?.[0])}
          />
          <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>
            Загрузить
          </button>
          {user?.avatar_url && (
            <button className="btn btn-ghost" onClick={() => void removeAvatar()}>
              Убрать
            </button>
          )}
        </div>
      </div>

      <AccountCard />

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Роль в команде</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          {me?.workspace_name ? `Компания «${me.workspace_name}». ` : ''}
          Роль назначает владелец или админ в разделе «Команда».
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              padding: '4px 12px',
              background: 'var(--asoft)',
              color: 'var(--accent)',
            }}
          >
            {ROLE_LABEL[role]}
          </span>
          <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{ROLE_HINT[role]}</span>
        </div>
      </div>

      <div className="card card-pad">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 4,
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
            Сессии и устройства
          </div>
          {(sessions?.length ?? 0) > 1 && (
            <button className="btn btn-ghost" onClick={() => void revokeAll()}>
              Выйти везде
            </button>
          )}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 10 }}>
          Устройства, с которых выполнен вход в аккаунт.
        </div>
        {sessions === null ? (
          <SkeletonRows rows={2} height={38} />
        ) : sessions.length === 0 ? (
          <div className="muted" style={{ fontSize: '12.5px' }}>
            Активных сессий не найдено
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {s.device}
                  {s.current && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        padding: '2px 8px',
                        background: 'var(--gsoft)',
                        color: 'var(--green)',
                      }}
                    >
                      это устройство
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                  {s.ip ?? 'IP неизвестен'} · был(а){' '}
                  {new Date(s.last_seen).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => void revokeOne(s)}>
                Выйти
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Тема</div>
        <div className="seg seg-flat" style={{ display: 'inline-flex' }}>
          <button
            className={mode === 'dark' ? 'on' : ''}
            style={{ padding: '6px 18px' }}
            onClick={() => setMode('dark')}
          >
            Тёмная
          </button>
          <button
            className={mode === 'light' ? 'on' : ''}
            style={{ padding: '6px 18px' }}
            onClick={() => setMode('light')}
          >
            Светлая
          </button>
          <button
            className={mode === 'system' ? 'on' : ''}
            style={{ padding: '6px 18px' }}
            onClick={() => setMode('system')}
          >
            Как в системе
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Помощь</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={() => window.dispatchEvent(new Event('tt-open-tour'))}
          >
            Тур по интерфейсу
          </button>
          <button
            className="btn btn-outline"
            onClick={() => window.dispatchEvent(new Event('tt-open-help'))}
          >
            Горячие клавиши (?)
          </button>
        </div>
      </div>
    </div>
  );
}
