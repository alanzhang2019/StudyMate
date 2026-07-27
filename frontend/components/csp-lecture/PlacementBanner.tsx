'use client';

/**
 * PlacementBanner — `/csp-lecture` 顶部的摸底入口
 *
 * Three states:
 *   1. Loading: skeleton shimmer
 *   2. 未摸底: amber CTA "2 分钟摸底" → opens PlacementModal
 *   3. 已摸底: gradient colored bar with level badge + 2 actions:
 *        - 查看推荐 → RecommendationCard
 *        - 重新摸底 → ConfirmResetModal (2-step confirm)
 *
 * Anonymous users (no session) → 401 on GET → treated as
 * "未摸底" with the same amber CTA. The POST will then 401
 * and surface the auth error in the modal.
 */

import { useEffect, useState } from 'react';
import { PlacementModal, type PlacementResponse } from './PlacementModal';
import { RecommendationCard } from './RecommendationCard';
import { ConfirmResetModal } from './ConfirmResetModal';

const LEVEL_LABEL: Record<string, string> = {
  beginner: '入门',
  intermediate: '中级',
  advanced: '高级',
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: 'from-emerald-400 to-teal-500',
  intermediate: 'from-blue-400 to-indigo-500',
  advanced: 'from-violet-500 to-fuchsia-500',
};

export function PlacementBanner() {
  const [placement, setPlacement] = useState<PlacementResponse | null | undefined>(
    undefined,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/csp-quiz/placement')
      .then(async (r) => {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setPlacement(d.placement ?? null);
      })
      .catch(() => {
        if (!cancelled) setPlacement(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (placement === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-4">
        <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (placement === null) {
    return (
      <>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-4">
          <div className="rounded-xl bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-200 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-amber-900">
              <span className="font-semibold">想了解你的 CSP 初赛水平？</span>
              <span className="text-amber-700 ml-1">
                2 分钟摸底，AI 推荐适合你的起点课件
              </span>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
            >
              2 分钟摸底
            </button>
          </div>
        </div>
        {modalOpen && (
          <PlacementModal
            onClose={() => setModalOpen(false)}
            onSubmitted={(p) => {
              setPlacement(p);
              setModalOpen(false);
            }}
          />
        )}
      </>
    );
  }

  // 已摸底
  const date = (() => {
    try {
      return new Date(placement.updatedAt).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  })();

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-4">
        <div
          className={`rounded-xl bg-gradient-to-r ${LEVEL_COLOR[placement.level]} px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap`}
        >
          <div className="text-sm text-white">
            <span className="font-semibold">已摸底{date && `（${date}）`}</span>
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-white/25 text-white text-xs font-bold">
              {LEVEL_LABEL[placement.level]}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRecommendOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-800 text-sm font-semibold hover:bg-white transition"
            >
              查看推荐
            </button>
            <button
              onClick={() => setConfirmResetOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/30 text-white text-sm font-medium hover:bg-white/40 transition border border-white/40"
            >
              重新摸底
            </button>
          </div>
        </div>
      </div>
      {recommendOpen && (
        <RecommendationCard
          placement={placement}
          onClose={() => setRecommendOpen(false)}
        />
      )}
      {modalOpen && (
        <PlacementModal
          onClose={() => setModalOpen(false)}
          onSubmitted={(p) => {
            setPlacement(p);
            setModalOpen(false);
          }}
        />
      )}
      {confirmResetOpen && (
        <ConfirmResetModal
          onCancel={() => setConfirmResetOpen(false)}
          onConfirm={() => {
            setConfirmResetOpen(false);
            setModalOpen(true);
          }}
        />
      )}
    </>
  );
}
