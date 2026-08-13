'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';

/** Карточка «Аккаунт» в Настройках: имя, email, верификация, смена пароля. */
export function AccountCard() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useWorkspace();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [passOpen, setPassOpen] = useState(false);
  const [passCur, setPassCur] = useState('');
  const [passNew, setPassNew] = useState('');
  const [passRep, setPassRep] = useState('');
  const [sending, setSending] = useState(false);

  // 2FA (для владельца и админов)
  const [tfaOpen, setTfaOpen] = useState(false);
  const [tfaQr, setTfaQr] = useState('');
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const tfaOn = !!user?.totp_enabled;

  const verified = !!user?.email_verified_at;

  async function openTfa() {
    try {
      const { secret, otpauth_url } = await api.setup2fa();
      setTfaSecret(secret);
      setTfaQr(await QRCode.toDataURL(otpauth_url, { margin: 1, width: 240 }));
      setTfaCode('');
      setTfaOpen(true);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось начать подключение 2FA');
    }
  }

  async function confirmTfa() {
    if (tfaCode.trim().length !== 6) {
      toast('Введите 6-значный код');
      return;
    }
    try {
      await api.enable2fa(tfaCode.trim());
      setTfaOpen(false);
      setUser({ ...user!, totp_enabled: true });
      toast('Двухфакторная аутентификация включена');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Неверный код');
    }
  }

  async function disableTfa() {
    try {
      await api.disable2fa();
      setUser({ ...user!, totp_enabled: false });
      toast('2FA отключена');
    } catch {
      toast('Не удалось отключить 2FA');
    }
  }

  async function saveProfile() {
    const patch: { name?: string; email?: string } = {};
    if (name.trim() && name.trim() !== user?.name) patch.name = name.trim();
    if (email.trim() && email.trim() !== user?.email) patch.email = email.trim();
    if (Object.keys(patch).length === 0) return;
    try {
      const updated = await api.updateMe(patch);
      setUser(updated);
      toast(
        patch.email
          ? 'Профиль сохранён — подтвердите новую почту'
          : 'Профиль сохранён',
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль');
      setName(user?.name ?? '');
      setEmail(user?.email ?? '');
    }
  }

  async function sendVerify() {
    setSending(true);
    try {
      await api.sendVerifyEmail();
      toast('Письмо с подтверждением отправлено — проверьте почту');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось отправить письмо');
    } finally {
      setSending(false);
    }
  }

  async function savePass() {
    if (passNew.length < 8) {
      toast('Новый пароль — минимум 8 символов');
      return;
    }
    if (passNew !== passRep) {
      toast('Пароли не совпадают');
      return;
    }
    try {
      await api.changePassword({
        current_password: passCur,
        new_password: passNew,
      });
      setPassOpen(false);
      setPassCur('');
      setPassNew('');
      setPassRep('');
      toast('Пароль изменён');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось изменить пароль');
    }
  }

  return (
    <div className="card card-pad">
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Аккаунт</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>Имя</div>
          <input
            className="input input-sm"
            style={{ width: '100%' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveProfile()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>Email</div>
          <input
            className="input input-sm"
            style={{ width: '100%' }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => void saveProfile()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            padding: '3px 10px',
            background: verified ? 'var(--gsoft)' : 'var(--ysoft)',
            color: verified ? 'var(--green)' : 'var(--amber)',
          }}
        >
          Почта: {verified ? 'подтверждена' : 'не подтверждена'}
        </span>
        {!verified && (
          <button className="btn-outline" disabled={sending} onClick={() => void sendVerify()}>
            {sending ? 'Отправляем…' : 'Отправить письмо'}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn-outline" onClick={() => setPassOpen((o) => !o)}>
          Сменить пароль
        </button>
      </div>

      {isAdmin && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Двухфакторная аутентификация
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
              Код при входе — для владельца и админов
            </div>
          </div>
          {tfaOn && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                padding: '3px 10px',
                background: 'var(--gsoft)',
                color: 'var(--green)',
              }}
            >
              Включена
            </span>
          )}
          <button
            className="btn-outline"
            onClick={() => (tfaOn ? void disableTfa() : void openTfa())}
          >
            {tfaOn ? 'Отключить' : 'Включить'}
          </button>
        </div>
      )}

      {tfaOpen && (
        <div
          onClick={() => setTfaOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.55)',
            zIndex: 75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 12,
              boxShadow: 'var(--shadow)',
              padding: '22px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Подключение 2FA
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 14 }}>
              Отсканируйте QR в приложении-аутентификаторе и введите код.
            </div>
            {tfaQr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tfaQr}
                alt="QR для приложения-аутентификатора"
                style={{ width: 120, height: 120, borderRadius: 10, margin: '0 auto 10px' }}
              />
            )}
            <div
              className="mono"
              style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 14, wordBreak: 'break-all' }}
            >
              {tfaSecret}
            </div>
            <input
              className="mono"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={tfaCode}
              onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmTfa();
              }}
              style={{
                width: 130,
                textAlign: 'center',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 9,
                fontSize: 16,
                letterSpacing: '0.3em',
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-outline" style={{ padding: '8px 16px' }} onClick={() => setTfaOpen(false)}>
                Отмена
              </button>
              <button
                className="btn btn-accent"
                style={{ borderRadius: 7, padding: '8px 18px', fontSize: '12.5px' }}
                onClick={() => void confirmTfa()}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {passOpen && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>Текущий</div>
            <input
              type="password"
              className="input input-sm"
              style={{ width: '100%' }}
              value={passCur}
              onChange={(e) => setPassCur(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
              Новый (мин. 8)
            </div>
            <input
              type="password"
              className="input input-sm"
              style={{ width: '100%' }}
              value={passNew}
              onChange={(e) => setPassNew(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>Повторите</div>
            <input
              type="password"
              className="input input-sm"
              style={{ width: '100%' }}
              value={passRep}
              onChange={(e) => setPassRep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void savePass();
              }}
            />
          </div>
          <button
            className="btn btn-accent"
            style={{ borderRadius: 7, padding: '8px 14px', fontSize: 13 }}
            onClick={() => void savePass()}
          >
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
