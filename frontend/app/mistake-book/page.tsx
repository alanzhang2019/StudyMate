import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft, BookMarked } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MistakeBookList } from '@/components/mistake-book/mistake-book-list';
import { VISITOR_COOKIE } from '@/lib/visitor/server';
import {
  listMistakeBookServer,
  type MistakeBookListResponse,
} from '@/lib/mistake-book/server';

export const dynamic = 'force-dynamic';

/**
 * Renders the visitor's personal "mistake book" — a list of
 * problems they have explicitly saved from the OCR result card
 * or the post-classroom shell. Server-rendered with the first
 * page preloaded so visitors see content immediately; subsequent
 * interactions (filter, toggle, delete) are handled client-side
 * via /api/mistake-book/*.
 */
export default async function MistakeBookPage() {
  // We reuse the same query path the browser will hit on the next
  // toggle. By reading the cookie directly (instead of going
  // through getOrCreateVisitorId) we guarantee that an unknown
  // visitor with no cookie sees the empty state without a set-cookie
  // side effect.
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;

  let initial: MistakeBookListResponse | null = null;
  if (visitorId) {
    try {
      initial = await listMistakeBookServer(visitorId, { limit: 100 });
    } catch (err) {
      // The list page has its own error UI; a server failure here
      // just means we render the empty state with a retry button.
      console.error('[/mistake-book] initial load failed', err);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" aria-label="返回首页">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <BookMarked className="h-6 w-6" />
              我的错题本
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              这里是你手动收藏的好题。在拍题页或讲题页点击「加入错题本」即可出现在这里。
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/mistake">去拍题</Link>
        </Button>
      </div>

      <MistakeBookList initial={initial} />
    </div>
  );
}
