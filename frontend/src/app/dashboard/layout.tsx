'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Nav } from '@/components/Nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="auth-wrap">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <div className="container">{children}</div>
    </>
  );
}
