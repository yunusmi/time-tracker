'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import type {
  AuditRow,
  TaskWithStats,
  WorkspaceInvite,
  WorkspaceMemberView,
  WorkspaceRole,
} from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { ROLE_LABEL, useWorkspace } from '@/context/WorkspaceContext';
import { openGenerator } from '@/components/ReportGenerator';
import { Avatar } from '@/components/Logo';
import { MemberProfile } from '@/components/MemberProfile';
import { SkeletonRows } from '@/components/Skeleton';

const MEMBERS_POLL_MS = 30_000;

function memberCountLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} участника`;
  return `${n} участников`;
}

const ASSIGNABLE_ROLES: WorkspaceRole[] = ['admin', 'pm', 'member', 'client'];

/** «18 авг» — до какого числа человек отсутствует. */
function absenceLabel(date: string | null): string {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    isAdmin,
    role: myRole,
    departments,
    money,
    rateLabel,
    me: ws,
    refreshMembers,
  } = useWorkspace();
  const { settings } = useSettings();
  const isOwner = myRole === 'owner';
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);

  const [members, setMembers] = useState<WorkspaceMemberView[]>([]);
  // Открытые задачи нужны для «Загрузки на неделю» (оценки vs норма).
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [depFilter, setDepFilter] = useState<string>('all');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');

  const visibleMembers = useMemo(
    () =>
      depFilter === 'all'
        ? members
        : members.filter((m) => m.department_id === depFilter),
    [members, depFilter],
  );

  /**
   * Загрузка на неделю: суммарная оценка открытых задач против нормы
   * (day_norm × 5). У отсутствующих вместо процентов — «отпуск до …».
   */
  const workload = useMemo(() => {
    const normHours = (ws?.day_norm_hours ?? 8) * 5;
    return visibleMembers
      .map((m) => {
        const estHours =
          tasks
            .filter(
              (t) =>
                t.status !== 'done' &&
                (t.assignee_id ?? t.user_id) === m.user_id,
            )
            .reduce((a, t) => a + (t.estimated_minutes ?? 0), 0) / 60;
        const hours = Math.round(estHours * 10) / 10;
        return {
          user_id: m.user_id,
          name: m.name,
          hours,
          percent: normHours ? Math.min(100, Math.round((hours / normHours) * 100)) : 0,
          over: hours > normHours,
          absence: m.absence_kind
            ? `${m.absence_kind === 'sick' ? 'б/л' : 'отпуск'} до ${absenceLabel(m.absence_until)}`
            : null,
        };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [visibleMembers, tasks, ws?.day_norm_hours]);

  const me = members.find((m) => m.user_id === user?.id);
  const canInvite = isAdmin;

  // Мини-дашборд команды для админа: кто трекает, недобор, перегруз.
  const dash = useMemo(() => {
    const weekGoalSec = settings.daily_goal_hours * 5 * 3600;
    const active = members.filter((m) => m.active_task_title);
    // Отсутствующие (отпуск/больничный) в недобор не попадают (ТЗ).
    const under = members.filter(
      (m) => !m.absence_kind && m.week_seconds < weekGoalSec * 0.5,
    );
    const over = members.filter((m) => m.week_seconds > weekGoalSec);
    const firstName = (n: string) => n.split(' ')[0];
    return {
      weekGoalH: settings.daily_goal_hours * 5,
      active: {
        n: active.length,
        names: active.map((m) => firstName(m.name)).join(', ') || '—',
      },
      under: {
        n: under.length,
        names: under.length
          ? `${firstName(under[0].name)} · ${formatHM(under[0].week_seconds)} из ${settings.daily_goal_hours * 5}ч`
          : '—',
      },
      over: {
        n: over.length,
        names: over.length
          ? `${firstName(over[0].name)} · ${formatHM(over[0].week_seconds)} за неделю`
          : '—',
      },
    };
  }, [members, settings.daily_goal_hours]);

  const load = useCallback(async () => {
    try {
      const [m, iv, t] = await Promise.all([
        api.getWorkspaceMembers(),
        api.listWorkspaceInvites().catch(() => [] as WorkspaceInvite[]),
        api.listTasks().catch(() => [] as TaskWithStats[]),
      ]);
      setMembers(m);
      setTasks(t);
      setLoading(false);
      setInvites(iv.filter((i) => i.email)); // ссылка-приглашение (email='') не показывается в списке
      setError('');
      api
        .listAudit()
        .then(setAudit)
        .catch(() => setAudit([]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить команду');
      setLoading(false);
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

  async function changeRole(targetUserId: string, role: WorkspaceRole) {
    setRoleMenuId(null);
    try {
      await api.changeMemberRole(targetUserId, { role });
      toast(`Роль изменена: ${ROLE_LABEL[role]}`);
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось изменить роль');
    }
  }

  return (
    <div>
      {profileId && (
        <MemberProfile
          userId={profileId}
          onClose={() => setProfileId(null)}
          onChanged={() => {
            void load();
            void refreshMembers();
          }}
        />
      )}
      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          {memberCountLabel(members.length)}
        </span>
        <div style={{ flex: 1 }} />
        {isAdmin && (
          <button
            className="btn-ghost"
            style={{ padding: '8px 14px', fontSize: 13, marginRight: 10 }}
            onClick={() => openGenerator({ mode: 'team' })}
          >
            ⚡ Сводка за вчера
          </button>
        )}
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

      {isAdmin && (
        <div className="grid-stats" style={{ marginBottom: 14 }}>
          <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
            <div className="stat-title">Сейчас трекают</div>
            <div className="mono" style={{ fontSize: 21, fontWeight: 600, margin: '3px 0' }}>
              {dash.active.n}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{dash.active.names}</div>
          </div>
          <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
            <div className="stat-title">Недобор к цели недели</div>
            <div
              className="mono"
              style={{ fontSize: 21, fontWeight: 600, margin: '3px 0', color: 'var(--amber)' }}
            >
              {dash.under.n}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{dash.under.names}</div>
          </div>
          <div className="card" style={{ borderRadius: 10, padding: '13px 16px' }}>
            <div className="stat-title">Перегруз (&gt;{dash.weekGoalH}ч)</div>
            <div
              className="mono"
              style={{ fontSize: 21, fontWeight: 600, margin: '3px 0', color: 'var(--red)' }}
            >
              {dash.over.n}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{dash.over.names}</div>
          </div>
        </div>
      )}

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

      {departments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            className={`chip ${depFilter === 'all' ? 'on' : ''}`}
            onClick={() => setDepFilter('all')}
          >
            Все отделы
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              className={`chip ${depFilter === d.id ? 'on' : ''}`}
              onClick={() => setDepFilter(d.id)}
            >
              {d.name}
            </button>
          ))}
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
          {isAdmin && <span style={{ width: 96, textAlign: 'right' }}>Ставка</span>}
          <span style={{ width: 90, textAlign: 'right' }}>Сегодня</span>
          <span style={{ width: 90, textAlign: 'right' }}>Неделя</span>
        </div>

        {loading && (
          <div style={{ padding: '12px 16px' }}>
            <SkeletonRows rows={3} height={40} />
          </div>
        )}

        {visibleMembers.map((m) => {
          const online = !!m.active_task_title;
          const canEditRole = isOwner && m.role !== 'owner' && m.user_id !== user?.id;
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
              <div style={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Avatar name={m.name} src={m.avatar_url} size={28} />
                <button
                  onClick={() => setProfileId(m.user_id)}
                  title="Открыть профиль сотрудника"
                  style={{
                    fontWeight: 600,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.name}
                </button>
                {m.user_id === user?.id && <span className="chip-badge">вы</span>}
                {m.department_name && (
                  <span className="chip-badge">{m.department_name}</span>
                )}
              </div>
              <div className="menu-wrap" style={{ width: 80 }}>
                {canEditRole ? (
                  <>
                    <button
                      onClick={() => setRoleMenuId(roleMenuId === m.user_id ? null : m.user_id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        padding: 0,
                        textAlign: 'left',
                      }}
                      title="Сменить роль"
                    >
                      {ROLE_LABEL[m.role]} ▾
                    </button>
                    {roleMenuId === m.user_id && (
                      <div className="menu" style={{ right: 'auto', minWidth: 120 }}>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <div
                            key={r}
                            className="menu-item"
                            style={{ fontSize: '12.5px' }}
                            onClick={() => void changeRole(m.user_id, r)}
                          >
                            {ROLE_LABEL[r]}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </div>
              <div
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '12.5px',
                  color: online || m.dnd ? 'var(--text)' : 'var(--muted)',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: m.absence_kind
                      ? 'var(--amber)'
                      : m.dnd
                        ? 'var(--red)'
                        : online
                          ? 'var(--green)'
                          : 'var(--border2)',
                    flexShrink: 0,
                  }}
                />
                {m.absence_kind
                  ? `${m.absence_kind === 'sick' ? 'На больничном' : 'В отпуске'} до ${absenceLabel(m.absence_until)}`
                  : m.dnd
                    ? 'Не беспокоить · фокус-сессия'
                    : online
                      ? `Трекает «${m.active_task_title}»`
                      : 'Не в сети'}
              </div>
              {isAdmin && (
                <span
                  className="mono"
                  style={{ width: 96, textAlign: 'right', fontSize: '12.5px', color: 'var(--muted)' }}
                  title={
                    m.pay_kind === 'salary'
                      ? 'Оклад пересчитан в часовую по норме'
                      : 'Персональная ставка'
                  }
                >
                  {m.hourly_rate ? `${money(m.hourly_rate)}${rateLabel.slice(-2)}` : '—'}
                </span>
              )}
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

      {/* Загрузка на неделю: часы против нормы (ТЗ, «Команда»). */}
      {isAdmin && workload.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Загрузка на неделю
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
            Открытые задачи против нормы {(ws?.day_norm_hours ?? 8) * 5}ч; за дни
            отпуска и больничного норма не начисляется.
          </div>
          {workload.map((w) => (
            <div
              key={w.user_id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
            >
              <span style={{ width: 130, fontSize: '12.5px' }}>{w.name}</span>
              <div className="progress" style={{ flex: 1 }}>
                <div
                  style={{
                    width: `${w.absence ? 0 : w.percent}%`,
                    background: w.over
                      ? 'var(--red)'
                      : w.percent > 80
                        ? 'var(--amber)'
                        : 'var(--green)',
                  }}
                />
              </div>
              <span
                className="mono"
                style={{
                  width: 130,
                  textAlign: 'right',
                  fontSize: '12px',
                  color: w.absence ? 'var(--amber)' : 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.absence ?? `${w.hours}ч из ${(ws?.day_norm_hours ?? 8) * 5}ч`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Журнал действий (admin+) */}
      {isAdmin && audit.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Журнал действий
          </div>
          {audit.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: '12.5px',
              }}
            >
              <span
                className="mono"
                style={{ fontSize: '11.5px', color: 'var(--muted)', width: 44, flexShrink: 0 }}
              >
                {new Date(a.created_at).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span style={{ fontWeight: 600, flexShrink: 0 }}>
                {a.user_name.split(' ')[0]}
              </span>
              <span style={{ color: 'var(--muted)' }}>{a.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
