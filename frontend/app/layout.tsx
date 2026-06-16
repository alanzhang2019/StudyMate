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
  title: 'AI讲题 · AI JiangTi | 拍一下就讲明白',
  description:
    'AI讲题（AI JiangTi）是一款面向小学 4-6 年级的 AI 数学错题讲解工具，拍题后即可生成循序渐进的互动讲解。',
  keywords: [
    'AI 错题本',
    'AI 讲题',
    '数学错题',
    '拍照讲题',
    '错题讲解',
    '小学数学',
    'AI JiangTi',
  ],
  authors: [{ name: 'AI 错题本' }],
  creator: 'AI 错题本',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://aijiangti.cn',
    siteName: 'AI 错题本',
    title: 'AI 错题本 · 拍一下就讲明白',
    description:
      '拍照识别数学错题，AI 生成互动讲解视频，举一反三练习。无需注册，即开即用。',
    images: [
      {
        url: '/og-cover.png',
        width: 1200,
        height: 630,
        alt: 'AI 错题本',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 错题本 · 拍一下就讲明白',
    description:
      '拍照识别数学错题，AI 生成互动讲解视频，举一反三练习。',
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
