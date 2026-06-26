import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-static';
export const revalidate = 3600;

const FEATURES = [
  {
    icon: '📸',
    title: '一拍识别',
    desc: '对着错题拍照，AI 自动识别题目、孩子答案与正确答案，3 秒出结果。',
  },
  {
    icon: '🎬',
    title: 'AI 互动讲解',
    desc: '生成循序渐进的互动视频讲解，孩子可以随时暂停、提问。',
  },
  {
    icon: '🔁',
    title: '举一反三',
    desc: '基于错题自动生成同类型练习，做错的下次优先出现。',
  },
  {
    icon: '📒',
    title: '手动收藏好题',
    desc: '讲完觉得重要的题，点一下「加入错题本」就归档，下次想看随时翻。',
  },
  {
    icon: '👨‍👩‍👧',
    title: '多学生档案',
    desc: '支持多个孩子共用一个账号，AI 区分学习进度与薄弱点。',
  },
  {
    icon: '📊',
    title: '家长学习看板',
    desc: '实时查看孩子的错题趋势、用时分布与最近学习活动。',
  },
];

const STEPS = [
  {
    n: '01',
    title: '拍照 / 上传',
    desc: '手机拍一下错题，或直接上传相册里的题目图片。',
  },
  {
    n: '02',
    title: 'AI 智能识别',
    desc: 'AI 自动读取题目、孩子写的答案，纠正并标出错因。',
  },
  {
    n: '03',
    title: '看讲解 + 同类题',
    desc: '生成动画讲解视频，再做一道同类型题巩固，举一反三。',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top nav */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
            题
          </div>
          <span className="text-lg font-bold text-slate-800">AI 错题本</span>
        </div>
        <div className="flex items-center gap-3">
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
          拍一下就讲明白
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
          孩子的错题
          <br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            交给 AI 来讲
          </span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          拍照即可识别数学错题，AI 生成循序渐进的互动讲解视频，
          配套举一反三练习。家长省心，孩子真懂。
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
            今晚就让孩子试试
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            拍一道错题，看 AI 怎么讲
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
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <div>© {new Date().getFullYear()} AI 错题本 · 让孩子真正学会</div>
          <div className="flex items-center gap-5">
            <Link href="/history" className="hover:text-slate-900">
              学习历史
            </Link>
            <Link href="/parent/dashboard" className="hover:text-slate-900">
              家长看板
            </Link>
            <Link href="/admin/login" className="hover:text-slate-900">
              管理后台
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
