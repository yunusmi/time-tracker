import './globals.css';
import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';

const instrumentSans = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mono',
});

const DESCRIPTION =
  'Время, задачи и отчёты команды в одном месте: таймер с таймлайном дня, ' +
  'таймшиты с утверждением, счета из billable-часов и стендапы, которые пишутся сами.';

export const metadata: Metadata = {
  title: 'Хронос — трекер времени для команд',
  description: DESCRIPTION,
  // Единый SVG-знак: favicon и иконка на домашнем экране.
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  openGraph: {
    title: 'Хронос — трекер времени для команд',
    description: DESCRIPTION,
    type: 'website',
    locale: 'ru_RU',
    images: ['/icon.svg'],
  },
};

/**
 * Тема применяется до гидратации, чтобы не мигала. Режим «как в системе»
 * читает prefers-color-scheme.
 */
const themeInit = `try{var t=localStorage.getItem('tt_theme');var s=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t==='light'?'light':t==='system'?s:t==='dark'?'dark':'dark')}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      data-theme="dark"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
