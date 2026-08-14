'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, clearToken, getToken, setToken } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    totpCode?: string,
    captchaAnswer?: string,
  ) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  /** Обновить пользователя в стейте (после PATCH /users/me и т.п.). */
  setUser: (user: AuthUser) => void;
  /** Перечитать пользователя с сервера (после входа по magic link). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      totpCode?: string,
      captchaAnswer?: string,
    ) => {
      const res = await api.login({
        email,
        password,
        totp_code: totpCode,
        captcha_answer: captchaAnswer,
      });
      setToken(res.access_token);
      setUser(res.user);
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      clearToken();
    }
  }, []);

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      const res = await api.register({ email, name, password });
      setToken(res.access_token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
