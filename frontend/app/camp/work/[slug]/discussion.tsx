'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * 作品讨论区 + 评分（作品详情页底部）。
 *
 * 完全匿名：昵称随手填（存 localStorage 便于下次），身份只认 httpOnly
 * cookie sm_visitor_id —— 该 id 只用于「删自己的评论」和「每人一票」，
 * 前端拿不到也不需要拿。
 *
 * 评分规则：1-5 星，同一浏览器对同一作品只有一票，重复打分是改分不是叠加，
 * 也可以撤掉自己的评分。
 */

type Comment = {
  id: string;
  parentId: string | null;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

type Rating = {
  avg: number;
  count: number;
  mine: number | null;
  dist: Record<1 | 2 | 3 | 4 | 5, number>;
};

const EMPTY_RATING: Rating = { avg: 0, count: 0, mine: null, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
const NAME_KEY = 'camp_comment_author_name';

/** createdAt 是 SQLite datetime('now') → 'YYYY-MM-DD HH:MM:SS'（UTC，无时区后缀）。 */
function fmtTime(raw: string): string {
  if (!raw) return '';
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function Stars({
  value,
  size = 'md',
  onPick,
  onHover,
  onLeave,
}: {
  value: number;
  size?: 'sm' | 'md';
  onPick?: (n: number) => void;
  onHover?: (n: number) => void;
  onLeave?: () => void;
}) {
  const interactive = !!onPick;
  return (
    <span className={`wdisc-stars wdisc-stars--${size}${interactive ? ' is-interactive' : ''}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const cls = `wdisc-star${filled ? ' is-filled' : ''}`;
        if (!interactive) {
          return (
            <svg key={n} className={cls} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
            </svg>
          );
        }
        return (
          <button
            key={n}
            type="button"
            className={cls}
            aria-label={`打 ${n} 星`}
            onClick={() => onPick?.(n)}
            onMouseEnter={() => onHover?.(n)}
            onFocus={() => onHover?.(n)}
            onMouseLeave={onLeave}
            onBlur={onLeave}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
            </svg>
          </button>
        );
      })}
    </span>
  );
}

export default function WorkDiscussion({ workId }: { workId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [rating, setRating] = useState<Rating>(EMPTY_RATING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [hoverScore, setHoverScore] = useState(0);
  const [rateBusy, setRateBusy] = useState(false);

  // 昵称记在本地，第二次评论不用再填
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
    } catch {
      /* localStorage 不可用（隐私模式）时忽略 */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/camp/works/${workId}/comments`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setComments(json.data?.comments ?? []);
      setRating(json.data?.rating ?? EMPTY_RATING);
    } catch (e: any) {
      setError(e?.message || '讨论区加载失败');
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPayload = (data: any) => {
    if (data?.comments) setComments(data.comments);
    if (data?.rating) setRating(data.rating);
  };

  const submitRating = async (score: number) => {
    if (rateBusy) return;
    setRateBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/camp/works/${workId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '评分失败');
      applyPayload(json.data);
    } catch (e: any) {
      setError(e?.message || '评分失败');
    } finally {
      setRateBusy(false);
    }
  };

  const withdrawRating = async () => {
    if (rateBusy) return;
    setRateBusy(true);
    try {
      const res = await fetch(`/api/camp/works/${workId}/rating`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '撤销失败');
      applyPayload(json.data);
    } catch (e: any) {
      setError(e?.message || '撤销失败');
    } finally {
      setRateBusy(false);
    }
  };

  const submitComment = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      try {
        window.localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        /* 忽略 */
      }
      const res = await fetch(`/api/camp/works/${workId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: name.trim(),
          body: text,
          parentId: replyTo?.id ?? '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '发表失败');
      applyPayload(json.data);
      setBody('');
      setReplyTo(null);
    } catch (e: any) {
      setError(e?.message || '发表失败');
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (id: string) => {
    if (!window.confirm('删除这条评论？它下面的回复也会一起删掉。')) return;
    try {
      const res = await fetch(`/api/camp/works/${workId}/comments/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '删除失败');
      applyPayload(json.data);
    } catch (e: any) {
      setError(e?.message || '删除失败');
    }
  };

  // 顶层评论 + 挂在它下面的回复（只一层，服务端已压平）
  const { topLevel, repliesOf } = useMemo(() => {
    const tops: Comment[] = [];
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      } else {
        tops.push(c);
      }
    }
    return { topLevel: tops, repliesOf: map };
  }, [comments]);

  const shownScore = hoverScore || rating.mine || 0;
  const distMax = Math.max(1, ...Object.values(rating.dist));

  return (
    <section className="work-discussion" id="discussion">
      <header className="work-discussion-heading">
        <p className="section-kicker">DISCUSSION / 讨论与评分</p>
        <h2>大家怎么说</h2>
        <p className="wdisc-sub">
          看完作品留个言、打个分吧。说得具体一点，创作者最想听的是「哪里好玩、哪里还能更好」。
        </p>
      </header>

      <div className="wdisc-rate-card">
        <div className="wdisc-rate-score">
          <strong>{rating.count > 0 ? rating.avg.toFixed(1) : '—'}</strong>
          <div>
            <Stars value={rating.avg} />
            <span className="wdisc-rate-count">
              {rating.count > 0 ? `${rating.count} 人评分` : '还没有人评分'}
            </span>
          </div>
        </div>

        <div className="wdisc-rate-action">
          <span className="wdisc-rate-label">
            {rating.mine ? `你打了 ${rating.mine} 星` : '给这个作品打个分'}
          </span>
          <div
            onMouseLeave={() => setHoverScore(0)}
            className="wdisc-rate-stars"
          >
            <Stars
              value={shownScore}
              onPick={submitRating}
              onHover={setHoverScore}
              onLeave={() => setHoverScore(0)}
            />
          </div>
          {rating.mine ? (
            <button
              type="button"
              className="wdisc-rate-clear"
              onClick={withdrawRating}
              disabled={rateBusy}
            >
              撤销我的评分
            </button>
          ) : null}
        </div>

        {rating.count > 0 ? (
          <ul className="wdisc-rate-dist">
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <li key={n}>
                <span className="wdisc-dist-label">{n} 星</span>
                <span className="wdisc-dist-bar">
                  <i style={{ width: `${(rating.dist[n] / distMax) * 100}%` }} />
                </span>
                <span className="wdisc-dist-num">{rating.dist[n]}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <form
        className="wdisc-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submitComment();
        }}
      >
        {replyTo ? (
          <div className="wdisc-reply-hint">
            回复 <strong>@{replyTo.authorName}</strong>
            <button type="button" onClick={() => setReplyTo(null)}>
              取消回复
            </button>
          </div>
        ) : null}
        <div className="wdisc-form-row">
          <input
            className="wdisc-input wdisc-input--name"
            placeholder="你的昵称（可不填）"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <textarea
          className="wdisc-input wdisc-textarea"
          placeholder="说点鼓励的话，或者提一个小建议…"
          maxLength={500}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="wdisc-form-foot">
          <span className="wdisc-counter">{body.length}/500</span>
          <button
            type="submit"
            className="wdisc-submit"
            disabled={!body.trim() || sending}
          >
            {sending ? '发送中…' : '发表评论'}
          </button>
        </div>
      </form>

      {error ? <p className="wdisc-error">{error}</p> : null}

      {loading ? (
        <p className="wdisc-empty">讨论区加载中…</p>
      ) : topLevel.length === 0 ? (
        <p className="wdisc-empty">还没有人留言，来说第一句吧。</p>
      ) : (
        <ol className="wdisc-list">
          {topLevel.map((c) => {
            const replies = repliesOf.get(c.id) ?? [];
            return (
              <li key={c.id} className="wdisc-item">
                <div className="wdisc-item-head">
                  <span className="wdisc-avatar" aria-hidden="true">
                    {c.authorName.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{c.authorName}</strong>
                    <time>{fmtTime(c.createdAt)}</time>
                  </div>
                  {c.mine ? (
                    <button
                      type="button"
                      className="wdisc-del"
                      onClick={() => removeComment(c.id)}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
                <p className="wdisc-body">{c.body}</p>
                <button
                  type="button"
                  className="wdisc-reply"
                  onClick={() => {
                    setReplyTo(c);
                    setBody('');
                    document.querySelector('.wdisc-textarea')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                  }}
                >
                  回复
                </button>

                {replies.length > 0 ? (
                  <ul className="wdisc-replies">
                    {replies.map((r) => (
                      <li key={r.id}>
                        <div className="wdisc-item-head">
                          <span className="wdisc-avatar wdisc-avatar--sm" aria-hidden="true">
                            {r.authorName.slice(0, 1)}
                          </span>
                          <div>
                            <strong>{r.authorName}</strong>
                            <time>{fmtTime(r.createdAt)}</time>
                          </div>
                          {r.mine ? (
                            <button
                              type="button"
                              className="wdisc-del"
                              onClick={() => removeComment(r.id)}
                            >
                              删除
                            </button>
                          ) : null}
                        </div>
                        <p className="wdisc-body">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
