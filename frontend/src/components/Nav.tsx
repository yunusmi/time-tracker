'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function Nav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) =>
    pathname === href ? 'active' : undefined;

  return (
    <nav className="nav">
      <span className="brand">⏱ Time Tracker</span>
      <Link href="/dashboard" className={isActive('/dashboard')}>
        Tracker
      </Link>
      <Link
        href="/dashboard/pomodoro"
        className={isActive('/dashboard/pomodoro')}
      >
        Pomodoro
      </Link>
      <span className="spacer" />
      {user && <span className="muted">{user.name}</span>}
      <button className="btn-ghost btn-sm" onClick={logout}>
        Log out
      </button>
    </nav>
  );
}
