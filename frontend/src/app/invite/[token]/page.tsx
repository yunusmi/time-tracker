'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function InviteAcceptPage({
  params,
}: {
  params: { token: string };
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const accepted = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Логин, затем возврат на эту страницу вручную по той же ссылке.
      router.replace('/login');
      return;
    }
    if (accepted.current) return;
    accepted.current = true;
    api
      .acceptInvite(params.token)
      .then(() => router.replace('/dashboard/team'))
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : 'Не удалось принять приглашение',
        );
      });
  }, [user, loading, params.token, router]);

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <h1>Приглашение</h1>
            <p className="error">{error}</p>
            <Link href="/dashboard">На главную</Link>
          </>
        ) : (
          <p className="muted">Принимаем приглашение…</p>
        )}
      </div>
    </div>
  );
}
