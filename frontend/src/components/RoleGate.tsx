'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';

const CLIENT_ALLOWED = ['/dashboard/reports', '/dashboard/settings'];

/**
 * Гейт страниц по ролям: клиенту доступны только Отчёты и Настройки —
 * прямые URL и хоткеи перенаправляются.
 */
export function RoleGate() {
  const { isClient, me } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!me) return; // роль ещё грузится
    if (isClient && !CLIENT_ALLOWED.includes(pathname)) {
      router.replace('/dashboard/reports');
    }
  }, [isClient, me, pathname, router]);

  return null;
}
