import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/app/components/ThemeToggle';

// 全站公共顶部导航。首页与「资料共享」独立页共用同一份导航，
// 避免两处各写一遍导致入口不一致。
export default function SiteHeader() {
  return (
    <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
          爱
        </div>
        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
          爱讲题
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <ThemeToggle />
        <Button asChild size="sm" variant="outline">
          <Link href="/camp">🚀 AI 原生教育</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/csp-lecture">📚 学生课件</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/textbooks">📖 深圳教材</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/clipboard">📋 资料共享</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href="https://aijiangti.cn/wrong-notebook/">📓 智能错题本</a>
        </Button>
        <Button asChild size="sm">
          <a href="/ai/">AI 自学</a>
        </Button>
      </div>
    </nav>
  );
}
