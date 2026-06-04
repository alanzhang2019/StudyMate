import type { Metadata } from 'next';
import { Baloo_2, Comic_Neue } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import 'animate.css';
import 'katex/dist/katex.min.css';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { I18nProvider } from '@/lib/hooks/use-i18n';
import { Toaster } from '@/components/ui/sonner';
import { ServerProvidersInit } from '@/components/server-providers-init';
import { AccessCodeGuard } from '@/components/access-code-guard';
import { NextAuthProvider } from '@/components/providers/session-provider';

const baloo = Baloo_2({ 
  subsets: ["latin"],
  variable: "--font-baloo-2",
  display: 'swap',
});

const comicNeue = Comic_Neue({
  weight: ['300', '400', '700'],
  subsets: ["latin"],
  variable: "--font-comic-neue",
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StudyMate | 作业通',
  description:
    'StudyMate 作业通是一款面向 4-6 年级的 AI 数学错题讲解工具，拍题后即可生成循序渐进的互动讲解。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${baloo.variable} ${comicNeue.variable}`} suppressHydrationWarning>
      <body
        className={`${GeistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <I18nProvider>
            <NextAuthProvider>
              <ServerProvidersInit />
              <AccessCodeGuard>{children}</AccessCodeGuard>
              <Toaster position="top-center" />
            </NextAuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
