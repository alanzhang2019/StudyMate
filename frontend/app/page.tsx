import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-static';
export const revalidate = 3600;

const FEATURES = [
  {
    icon: '📝',
    title: '在线创建课件',
    desc: '无需下载软件，登录网站即可创建并管理你的个人学习课件。',
  },
  {
    icon: '📚',
    title: '用于教学',
    desc: '把课件分享到课堂或培训场景，方便老师按章节讲解与互动。',
  },
  {
    icon: '🗂',
    title: '学习记录',
    desc: '每一次编辑与查看自动归档为学习记录，方便日后复习与复盘。',
  },
];

const STEPS = [
  {
    n: '01',
    title: '新建课件',
    desc: '填写课件标题、简介与章节大纲，快速搭建课件骨架。',
  },
  {
    n: '02',
    title: '编辑内容',
    desc: '在线编辑课件内容、添加学习资料，支持图文与音视频。',
  },
  {
    n: '03',
    title: '教学 / 记录',
    desc: '将课件用于课堂教学，或保存为个人学习记录随时回看。',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top nav */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
            爱
          </div>
          <span className="text-lg font-bold text-slate-800">爱讲题</span>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/csp-lecture">📚 学生课件</Link>
          </Button>
          <Link
            href="/admin/login"
            className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline"
          >
            管理员入口
          </Link>
          <Button asChild size="sm">
            <Link href="/mistake">立即开始</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 sm:pt-16 sm:pb-28 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest text-blue-700 bg-blue-100 rounded-full px-3 py-1 mb-5">
          爱讲题 · 创建你的专属课件
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
          创建个人学习课件
          <br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            用于教学或者学习记录
          </span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          爱讲题是一款在线课件创建平台，用户可通过网站创建个人学习课件，
          用于教学或者学习记录。
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Button asChild size="lg" className="text-base px-8 h-12">
            <Link href="/mistake">免费使用 →</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base h-12">
            <Link href="#features">了解功能</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          无需注册 · 即开即用
        </p>
      </section>

      {/* 3 steps */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
          三步搞定一道错题
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <Card key={s.n} className="bg-white/70 backdrop-blur border-slate-200/60">
              <CardContent className="pt-6">
                <div className="text-4xl font-extrabold text-blue-600/30 mb-2">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {s.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {s.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section
        id="features"
        className="max-w-6xl mx-auto px-6 pb-20 scroll-mt-20"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-3">
          不止讲题，更是学习闭环
        </h2>
        <p className="text-slate-600 text-center max-w-2xl mx-auto mb-12">
          从错题识别到讲解视频，从同类题巩固到家长看板，
          把"做错 → 听懂 → 不再错"这条路打通。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <Card
              key={f.title}
              className="bg-white/80 backdrop-blur border-slate-200/60 hover:shadow-md transition-shadow"
            >
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-base font-semibold text-slate-900 mb-1.5">
                  {f.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-14 text-center text-white shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            马上创建你的第一份课件
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            用于教学或者学习记录
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white text-blue-700 hover:bg-blue-50 text-base h-12 px-8"
          >
            <Link href="/mistake">立即开始 →</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-5 text-sm text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} 爱讲题 · 用户可创建个人学习课件，用于教学或者学习记录</div>
            <div className="flex items-center gap-5">
              <Link href="/csp-lecture" className="hover:text-slate-900">
                学生课件
              </Link>
              <Link href="/mistake-book" className="hover:text-slate-900">
                错题本
              </Link>
              <Link href="/history" className="hover:text-slate-900">
                学习历史
              </Link>
              <Link href="/parent/dashboard" className="hover:text-slate-900">
                我是父母
              </Link>
              <Link href="/admin/login" className="hover:text-slate-900">
                管理后台
              </Link>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200/70 text-xs text-slate-500">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1">
              <span>办公地址：深圳市龙岗区南湾街道樟富北路8号3-6</span>
              <span>
                联系电话：
                <a href="tel:13502813610" className="hover:text-slate-900">
                  13502813610
                </a>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true">🛡</span>
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900"
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
