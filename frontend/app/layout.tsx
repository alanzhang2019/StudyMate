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
  title: '爱讲题 · 自学立身，创造立世',
  description:
    '爱讲题把 AI 自学、信息学奥赛、深圳教材、资料共享与智能错题本收进同一个入口：拍一道题或打一句话，AI 从思路讲到步骤，学完接着做同类题与单元测评。',
  keywords: [
    '爱讲题',
    'AI 自学',
    '信息学奥赛',
    'CSP 初赛',
    '深圳教材',
    '智能错题本',
    '资料共享',
  ],
  authors: [{ name: '爱讲题' }],
  creator: '爱讲题',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://aijiangti.cn',
    siteName: '爱讲题',
    title: '爱讲题 · 自学立身，创造立世',
    description:
      '爱讲题把 AI 自学、信息学奥赛、深圳教材、资料共享与智能错题本收进同一个入口：拍一道题或打一句话，AI 从思路讲到步骤，学完接着做同类题与单元测评。',
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
    title: '爱讲题 · 自学立身，创造立世',
    description:
      '爱讲题把 AI 自学、信息学奥赛、深圳教材、资料共享与智能错题本收进同一个入口：拍一道题或打一句话，AI 从思路讲到步骤，学完接着做同类题与单元测评。',
    images: ['/og-cover.png'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '爱讲题',
    statusBarStyle: 'default',
  },
  // ★ Next 16 的 `appleWebApp.capable` 只会输出 `mobile-web-app-capable`（无 apple- 前缀），
  //   而 iOS Safari 认的是 `apple-mobile-web-app-capable` ⇒ iOS 16.3 及更早会开成带地址栏的网页。
  //   iOS 16.4+ 走 manifest 的 display:standalone，但老设备仍要靠这个 meta，
  //   所以用 `other` 补一条精确的 apple- 前缀版本。
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
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

  // 站点访问码门禁开关。服务端只读 process.env（不读 cookie，因此不会
  // 把静态页强制转为动态渲染）：静态页在构建期求值，动态页在请求期求值。
  // 这里只作为"未知状态下能否先渲染内容"的提示；最终判定以
  // /api/access-code/status 的运行时结果为准。
  const accessCodeEnabled = !!process.env.ACCESS_CODE;

  return (
    <html lang="zh-CN" className={`${baloo.variable} ${comicNeue.variable}`} suppressHydrationWarning>
      <body
        className={`${GeistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {/* 在首屏绘制前根据 localStorage / 系统偏好设置 .dark，避免深色模式闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s?(s==='dark'||(s==='system'&&m)):m;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <VisitorBootstrap visitorId={visitorId} />
        <ThemeProvider>
          <I18nProvider>
            <NextAuthProvider>
              <ServerProvidersInit />
              <AccessCodeGuard enabled={accessCodeEnabled}>{children}</AccessCodeGuard>
              <Toaster position="top-center" />
            </NextAuthProvider>
          </I18nProvider>
        </ThemeProvider>
        <DebugConsole />
      </body>
    </html>
  );
}
