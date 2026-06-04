'use client';

import Link from 'next/link';

export default function MistakeLiveSessionPage() {
  return (
    <main style={{ padding: 24, display: 'grid', gap: 12 }}>
      <h1>此页面不再作为主入口</h1>
      <p>新的错题讲解会在确认题目后直接进入原版生成与播放流程。</p>
      <p>如果你是从旧链接进入，可以返回重新拍题再开始。</p>
      <Link href="/mistake">返回重新拍题</Link>
    </main>
  );
}
