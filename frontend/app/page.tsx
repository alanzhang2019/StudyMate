import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SiteHeader from '@/app/components/SiteHeader';

export const dynamic = 'force-static';
export const revalidate = 3600;

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
    title: '资料共享',
    desc: '一页剪贴板就能把题目、笔记、链接攒成自己的资料页。',
    href: '/clipboard',
  },
  {
    icon: '📓',
    title: '智能错题本',
    desc: '错题自动归因、同类题变式巩固，把“做错 → 不再错”打通。',
    href: 'https://aijiangti.cn/wrong-notebook/',
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors">
      {/* Top nav */}
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 sm:pt-16 sm:pb-28 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950/50 rounded-full px-3 py-1 mb-5">
          爱讲题 · AI 自学
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-slate-50 leading-tight tracking-tight transition-colors">
          把不会的题问到底
          <br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            讲到真正懂为止
          </span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed transition-colors">
          拍一道题、打一句话，AI 从思路讲到步骤；学完接着做同类题与单元测评，
          掌握度自己说了算。教材、错题本、奥赛精讲，都在同一个入口里。
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Button asChild size="lg" className="text-base px-8 h-12">
            <a href="/ai/">进入 AI 自学 →</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base h-12">
            <Link href="#features">了解功能</Link>
          </Button>
        </div>
      </section>

      {/* 3 steps */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 text-center mb-12 transition-colors">
          三步把一道题真正拿下
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <Card
              key={s.n}
              className="bg-white/70 backdrop-blur border-slate-200/60 dark:bg-slate-800/60 dark:border-slate-700/60 transition-colors"
            >
              <CardContent className="pt-6">
                <div className="text-4xl font-extrabold text-blue-600/30 mb-2">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 transition-colors">
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
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 text-center mb-3 transition-colors">
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
              <Card className="h-full bg-white/80 backdrop-blur border-slate-200/60 hover:shadow-md hover:border-blue-300 dark:bg-slate-800/60 dark:border-slate-700/60 dark:hover:border-blue-600 transition-colors">
                <CardContent className="pt-6">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5 transition-colors">
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

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 px-8 py-14 text-center text-white shadow-xl transition-colors">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            现在就问一道题
          </h2>
          <p className="text-blue-100 dark:text-blue-200 mb-8 text-lg transition-colors">
            拍照、打字都行，讲到你懂
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white text-blue-700 hover:bg-blue-50 text-base h-12 px-8"
          >
            <a href="/ai/">AI 自学 →</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/40 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/40 transition-colors">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-5 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} 爱讲题 · AI 自学与学习工具箱</div>
            <div className="flex items-center gap-5">
              <Link href="/camp" className="hover:text-slate-900 dark:hover:text-slate-100">
                AI 原生教育
              </Link>
              <Link href="/csp-lecture" className="hover:text-slate-900 dark:hover:text-slate-100">
                信息学奥赛
              </Link>
              <Link href="/mistake-book" className="hover:text-slate-900 dark:hover:text-slate-100">
                错题本
              </Link>
              <Link href="/history" className="hover:text-slate-900 dark:hover:text-slate-100">
                学习历史
              </Link>
              <Link href="/parent/dashboard" className="hover:text-slate-900 dark:hover:text-slate-100">
                我是父母
              </Link>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1">
              <span>办公地址：深圳市龙岗区南湾街道樟富北路8号3-6</span>
              <span>
                联系电话：
                <a href="tel:0755-86993610" className="hover:text-slate-900 dark:hover:text-slate-100">
                  0755-86993610
                </a>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true">🛡</span>
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 dark:hover:text-slate-100"
              >
                粤ICP备2023157905号
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
