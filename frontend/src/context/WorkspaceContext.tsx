'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '@/lib/api';
import type { WorkspaceMe, WorkspaceMemberView, WorkspaceRole } from '@/lib/types';

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  pm: 'Менеджер',
  member: 'Участник',
  client: 'Клиент',
};

interface WorkspaceContextValue {
  me: WorkspaceMe | null;
  role: WorkspaceRole;
  /** owner/admin: управляют проектами, назначают задачи, видят чужие отчёты и деньги. */
  isAdmin: boolean;
  /** Видит раздел «Проекты» (admin+ и менеджер своего проекта). */
  canSeeProjects: boolean;
  /** Клиент видит только Отчёты и Настройки. */
  isClient: boolean;
  members: WorkspaceMemberView[];
  refreshMembers: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<WorkspaceMe | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberView[]>([]);

  const refreshMembers = useCallback(async () => {
    try {
      setMembers(await api.getWorkspaceMembers());
    } catch {
      /* member/client без доступа — не критично */
    }
  }, []);

  useEffect(() => {
    api
      .getWorkspaceMe()
      .then(setMe)
      .catch(() => undefined);
    void refreshMembers();
  }, [refreshMembers]);

  const role = me?.role ?? 'member';
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <WorkspaceContext.Provider
      value={{
        me,
        role,
        isAdmin,
        canSeeProjects: isAdmin || role === 'pm',
        isClient: role === 'client',
        members,
        refreshMembers,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}
