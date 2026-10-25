import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import SiteHeader from '@/app/components/SiteHeader';
import InstallGuide from '@/app/components/InstallGuide';

export const dynamic = 'force-static';
export const revalidate = 3600;

// 品牌色（2026-10-26 定稿口径）
//   --blue   #2B5CFF   AI 自学平台（后浪奔涌子品牌）
//   --navy   #0F1E3D   AI 原生教育主色
//   --yellow #FFD24A   少年 AI 创造营强调色
//   --cream  #F7F5F0   页面底色（浅色极简，无黑色块）

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI 自学',
    desc: '拍照或打字提出问题，AI 从思路讲到步骤，讲到你跟上为止。',
    href: '/ai/',
  },
  {
    icon: '🚀',
    title: 'AI 原生教育',
    desc: '科学素养与课程活动，在“看见科学”里动手把概念做出来。',
    href: '/camp',
  },
  {
    icon: '📚',
    title: '信息学奥赛',
    desc: 'CSP 初赛要点精讲，按章节刷考点，附排行与阶段测评。',
    href: '/csp-lecture',
  },
  {
    icon: '📖',
    title: '深圳教材',
    desc: '对照深圳教材版本自学，课内课外来回跳，页页有出处。',
    href: '/textbooks',
  },
  {
    icon: '📋',
    title: '云剪切板',
    desc: '一页剪贴板就能把题目、笔记、链接攒成自己的资料页。',
    href: '/clipboard',
  },
];

const STEPS = [
  {
    n: '01',
    title: '提出问题',
    desc: '拍一张题或者直接打字，AI 先认出题目在问什么，不让你反复描述。',
  },
  {
    n: '02',
    title: '听懂讲解',
    desc: '从思路到步骤讲清楚，卡在哪一步就问哪一步，直到你说“懂了”。',
  },
  {
    n: '03',
    title: '测稳再走',
    desc: '学完立刻做同类题和单元测评，分数与掌握度说了算，不靠感觉。',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F0] dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors">
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

      {/* 3 steps */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1E3D] dark:text-slate-50 text-center mb-12 transition-colors">
          三步把一道题真正拿下
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <Card
              key={s.n}
              className="bg-white/70 backdrop-blur border-slate-200/60 dark:bg-slate-800/60 dark:border-slate-700/60 transition-colors"
            >
              <CardContent className="pt-6">
                <div className="text-4xl font-extrabold text-[#2B5CFF]/30 mb-2">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold text-[#0F1E3D] dark:text-slate-100 mb-2 transition-colors">
                  {s.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed transition-colors">
                  {s.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 模块网格：首页 = AI 自学 + 工具箱的完整入口 */}
      <section
        id="features"
        className="max-w-6xl mx-auto px-6 pb-20 scroll-mt-20"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1E3D] dark:text-slate-50 text-center mb-3 transition-colors">
          不止讲题，更是学习闭环
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-center max-w-2xl mx-auto mb-12 transition-colors">
          从提问到听懂、从同类题巩固到单元测评，
          把“做错 → 听懂 → 不再错”这条路打通。入口都在这。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => {
            // ★ `/ai/` 是 hl-platform（同一个域名下的**另一个 Next 应用**）。
            //   走 Next 的客户端软导航会去要本站根本不存在的 chunk ⇒ 白屏或 404。
            //   所以跨应用一律 `<a>` 整页跳转（Hero 主按钮与 Final CTA 同理）。
            const isCrossApp = f.href.startsWith('http') || f.href.startsWith('/ai/');
            const card = (
              <Card className="h-full bg-white/80 backdrop-blur border-slate-200/60 hover:shadow-md hover:border-[#2B5CFF]/50 dark:bg-slate-800/60 dark:border-slate-700/60 dark:hover:border-blue-600 transition-colors">
                <CardContent className="pt-6">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-base font-semibold text-[#0F1E3D] dark:text-slate-100 mb-1.5 flex items-center gap-1.5 transition-colors">
                    {f.title}
                    <span className="text-slate-400 dark:text-slate-500 text-xs" aria-hidden="true">
                      →
                    </span>
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed transition-colors">
                    {f.desc}
                  </p>
                </CardContent>
              </Card>
            );
            const cls = 'block h-full';
            return isCrossApp ? (
              <a key={f.title} href={f.href} className={cls}>
                {card}
              </a>
            ) : (
              <Link key={f.title} href={f.href} className={cls}>
                {card}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 装到手机桌面：把云端版变成「一个 App」—— 步骤写在首页，学生不用自己摸索 */}
      <InstallGuide />

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-3xl px-8 py-14 text-center text-white shadow-xl transition-colors bg-[#0F1E3D]">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            现在就问一道题
          </h2>
          <p className="text-slate-200 mb-8 text-lg transition-colors">
            拍照、打字都行，讲到你懂
          </p>
          <a
            href="/ai/"
            className="inline-flex items-center justify-center h-12 px-8 text-base font-semibold rounded-xl bg-[#FFD24A] text-[#0F1E3D] hover:bg-[#f2c233] transition-colors"
          >
            AI 自学 →
          </a>
        </div>
      </section>

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
