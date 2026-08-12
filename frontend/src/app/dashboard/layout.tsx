'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { TimerProvider } from '@/context/TimerContext';
import { PomodoroProvider } from '@/context/PomodoroContext';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { FocusMode } from '@/components/FocusMode';
import { GlobalOverlays } from '@/components/GlobalOverlays';

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
        <p className="muted">Загрузка…</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <SettingsProvider>
          <TimerProvider>
            <PomodoroProvider>
              <div className="shell">
                <Sidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Header />
                  <main className="content">
                    <div className="content-inner">{children}</div>
                  </main>
                </div>
                <FocusMode />
                <GlobalOverlays />
              </div>
            </PomodoroProvider>
          </TimerProvider>
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
