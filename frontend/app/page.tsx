import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import InstallGuide from '@/app/components/InstallGuide';

export const dynamic = 'force-static';
export const revalidate = 3600;

// 品牌色（2026-10-26 定稿口径）
//   --blue   #2B5CFF   AI 自学平台（后浪奔涌子品牌）
//   --navy   #0F1E3D   AI 原生教育主色
//   --yellow #FFD24A   少年 AI 创造营强调色
//   --cream  #F7F5F0   页面底色（浅色极简，无黑色块）



export default function LandingPage() {
  // 浅色：品牌米白 #F7F5F0（无黑色块）；深色：跟随全站深色底 slate-950。
  // ⚠️ 别只写 dark:from/via/to —— 那是渐变色标，没有 bg-gradient-to-* 时全部失效，
  //    背景会停在浅色米白，而 dark:text-* 又把文字翻成浅色 ⇒ 浅字压浅底看不见（线上事故根因）。
  return (
    <main className="min-h-screen bg-[#F7F5F0] dark:bg-slate-950 transition-colors">
      {/* Top nav */}
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-16 sm:pt-16 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          {/* 左：文案 */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-[#2B5CFF] bg-[#2B5CFF]/10 dark:text-blue-300 dark:bg-blue-950/50 rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2B5CFF]" aria-hidden="true"></span>
              AI 自学平台 · AI 原生教育
            </span>

            <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight transition-colors">
              <span className="block text-[#2B5CFF]">自学立身</span>
              <span className="block text-[#0F1E3D] dark:text-slate-100">创造立世</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed transition-colors">
              顺着教材把知识点逐个点亮，或者带着想法做出自己的作品。
              自学，把不会的问到底；创造，把想法变成现实。
            </p>

            <div className="mt-10 flex items-center justify-center lg:justify-start gap-4 flex-wrap">
              <a
                href="/ai/"
                className="inline-flex items-center justify-center h-12 px-8 text-base font-semibold rounded-xl bg-[#2B5CFF] text-white hover:bg-[#1f4ae0] transition-colors"
              >
                进入 AI 自学平台
              </a>
              <a
                href="/camp"
                className="inline-flex items-center justify-center h-12 px-8 text-base font-semibold rounded-xl bg-[#FFD24A] text-[#0F1E3D] hover:bg-[#f2c233] transition-colors"
              >
                进入 AI 原生教育
              </a>
            </div>
          </div>

          {/* 右：产品叠卡视觉 */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-[0_24px_60px_-20px_rgba(15,30,61,0.35)] ring-1 ring-slate-900/5">
              <img
                src="/assets/homepage/star.png"
                alt="AI 自学平台 · 知识星空"
                className="w-full h-auto block"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 w-56 sm:w-64 rounded-xl overflow-hidden shadow-[0_16px_40px_-12px_rgba(15,30,61,0.4)] ring-1 ring-slate-900/10">
              <img
                src="/assets/homepage/camp.png"
                alt="AI 原生教育 · 少年 AI 创造营"
                className="w-full h-auto block"
              />
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2B5CFF]" aria-hidden="true"></span>
              <span>后浪奔涌 · 知识星空 ｜ AI 原生教育</span>
            </div>
          </div>
        </div>
      </section>

      {/* 将网页版变成手机APP */}
      <InstallGuide />

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-white/60 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/40 transition-colors">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <img
              src="/assets/homepage/logo.png"
              alt="爱讲题 logo"
              className="h-7 w-auto"
            />
            <span className="font-bold text-[#0F1E3D] dark:text-slate-100">爱讲题</span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
            <span>自学立身，创造立世。</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3.2l7 2.9v5.4c0 4.2-2.9 7.6-7 9.3-4.1-1.7-7-5.1-7-9.3V6.1l7-2.9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
              <span>粤ICP备2023157905号</span>
            </a>
            <span>© {new Date().getFullYear()} 爱讲题 · aijiangti.cn 版权所有</span>
            <nav className="flex items-center gap-4" aria-label="法务链接">
              <Link href="#" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                隐私政策
              </Link>
              <Link href="#" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                服务条款
              </Link>
              <Link href="#" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                意见反馈
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
