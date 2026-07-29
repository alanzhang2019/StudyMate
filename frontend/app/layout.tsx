import type { Metadata, Viewport } from 'next';
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
import { VisitorBootstrap } from '@/components/VisitorBootstrap';
import { getOrGenerateVisitorId } from '@/lib/visitor/server';
import { DebugConsole } from '@/components/DebugConsole';

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://aijiangti.cn',
  ),
  title: '爱讲题 · 用户可创建个人学习课件，用于教学或者学习记录',
  description:
    '爱讲题是一款在线课件创建平台，用户可通过网站创建个人学习课件，用于教学或者学习记录。',
  keywords: [
    '爱讲题',
    '学习课件',
    '课件创建',
    '教学',
    '学习记录',
    '个人课件',
  ],
  authors: [{ name: '爱讲题' }],
  creator: '爱讲题',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://aijiangti.cn',
    siteName: '爱讲题',
    title: '爱讲题 · 用户可创建个人学习课件，用于教学或者学习记录',
    description:
      '爱讲题是一款在线课件创建平台，用户可通过网站创建个人学习课件，用于教学或者学习记录。',
    images: [
      {
        url: '/og-cover.png',
        width: 1200,
        height: 630,
        alt: '爱讲题',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '爱讲题 · 用户可创建个人学习课件，用于教学或者学习记录',
    description:
      '爱讲题是一款在线课件创建平台，用户可通过网站创建个人学习课件，用于教学或者学习记录。',
    images: ['/og-cover.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/logo.svg',
  },
};

// Force light color-scheme on every UA so that
// iOS Safari / WeChat WebView / Android Chrome in
// "auto dark mode" does not repaint native form
// controls (input, button, placeholder text) with
// dark-mode colors. Without this, system dark mode
// renders inputs/buttons with light-on-white that
// becomes invisible against the white card.
// `light dark` would still allow dark on dark UAs;
// `light` disables both branches entirely.
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#F8FAFC',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Every request gets a stable, anonymous visitor id. We mint it
  // here in the root server layout (not in middleware) so we can
  // hand the same value to both the cookie *and* the client-side
  // `VisitorBootstrap` component that copies it into localStorage
  // for fetch() attribution.
  const visitorId = await getOrGenerateVisitorId();
  return (
    <html lang="zh-CN" className={`${baloo.variable} ${comicNeue.variable}`} suppressHydrationWarning>
      <body
        className={`${GeistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <VisitorBootstrap visitorId={visitorId} />
        <ThemeProvider>
          <I18nProvider>
            <NextAuthProvider>
              <ServerProvidersInit />
              <AccessCodeGuard>{children}</AccessCodeGuard>
              <Toaster position="top-center" />
            </NextAuthProvider>
          </I18nProvider>
        </ThemeProvider>
        <DebugConsole />
      </body>
    </html>
  );
}
