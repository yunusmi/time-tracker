'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '@/lib/api';
import { formatMoney, ratePerHour } from '@/lib/money';
import type {
  Currency,
  Department,
  WorkspaceListItem,
  WorkspaceMe,
  WorkspaceMemberView,
  WorkspaceRole,
} from '@/lib/types';

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
  departments: Department[];
  /** Компании пользователя для переключателя в сайдбаре. */
  workspaces: WorkspaceListItem[];
  currency: Currency;
  /** Формат суммы в валюте компании. */
  money: (value: number) => string;
  /** Подпись ставки, например «₽/ч». */
  rateLabel: string;
  refreshMembers: () => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<WorkspaceMe | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberView[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);

  const refreshMembers = useCallback(async () => {
    try {
      setMembers(await api.getWorkspaceMembers());
    } catch {
      /* member/client без доступа — не критично */
    }
    try {
      setDepartments(await api.listDepartments());
    } catch {
      /* отделы доступны не всем ролям */
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api.getWorkspaceMe());
    } catch {
      /* не авторизован — не критично */
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      setWorkspaces(await api.listWorkspaces());
    } catch {
      /* не критично */
    }
  }, []);

  const switchWorkspace = useCallback(
    async (id: string) => {
      await api.switchWorkspace(id);
      await Promise.all([refreshMe(), refreshWorkspaces(), refreshMembers()]);
      // Данные всех экранов привязаны к компании — перезагружаем кабинет.
      window.location.reload();
    },
    [refreshMe, refreshWorkspaces, refreshMembers],
  );

  useEffect(() => {
    void refreshMe();
    void refreshMembers();
    void refreshWorkspaces();
  }, [refreshMe, refreshMembers, refreshWorkspaces]);

  const role = me?.role ?? 'member';
  const isAdmin = role === 'owner' || role === 'admin';
  const currency = me?.currency ?? 'RUB';

  return (
    <WorkspaceContext.Provider
      value={{
        me,
        role,
        isAdmin,
        canSeeProjects: isAdmin || role === 'pm',
        isClient: role === 'client',
        members,
        departments,
        workspaces,
        currency,
        money: (value: number) => formatMoney(value, currency),
        rateLabel: ratePerHour(currency),
        refreshMembers,
        refreshMe,
        refreshWorkspaces,
        switchWorkspace,
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
