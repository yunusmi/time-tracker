'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { TimerProvider } from '@/context/TimerContext';
import { PomodoroProvider } from '@/context/PomodoroContext';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { FocusMode } from '@/components/FocusMode';
import { GlobalOverlays } from '@/components/GlobalOverlays';
import { ReportGenerator } from '@/components/ReportGenerator';
import { OnboardingTour } from '@/components/OnboardingTour';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RoleGate } from '@/components/RoleGate';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Мобильная шторка сайдбара (<760px): открывается ☰, закрывается по клику/переходу.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => setSidebarOpen(false), [pathname]);

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
          <WorkspaceProvider>
          <TimerProvider>
            <PomodoroProvider>
              <div className="shell">
                <div
                  className={`sidebar-backdrop ${sidebarOpen ? 'mobile-open' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                />
                <Sidebar mobileOpen={sidebarOpen} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Header onBurger={() => setSidebarOpen((o) => !o)} />
                  <main className="content">
                    <div className="content-inner">{children}</div>
                  </main>
                </div>
                <FocusMode />
                <GlobalOverlays />
                <ReportGenerator />
                <OnboardingTour />
                <OfflineBanner />
                <RoleGate />
              </div>
            </PomodoroProvider>
          </TimerProvider>
          </WorkspaceProvider>
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
