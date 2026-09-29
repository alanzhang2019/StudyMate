import SiteHeader from '@/app/components/SiteHeader';
import SharedClipboard from '@/app/components/SharedClipboard';

export const metadata = {
  title: '资料共享 · 爱讲题',
  description:
    '建一个房间码，把链接发到班级群，老师和学生就能在同一个页面里拖拽上传、粘贴文本、随时下载——无需注册，即开即用。',
};

export default function ClipboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors">
      <SiteHeader />

      <section className="max-w-6xl mx-auto px-6 pt-4 pb-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 text-center mb-3 transition-colors">
          资料共享，从一页开始
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-center max-w-2xl mx-auto mb-10 transition-colors">
          建一个房间码，把链接发到班级群，老师和学生就能在同一个页面里
          拖拽上传、粘贴文本、随时下载——无需注册，即开即用。
        </p>
        <SharedClipboard />
      </section>
    </main>
  );
}
