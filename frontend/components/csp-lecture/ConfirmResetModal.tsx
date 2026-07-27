'use client';

/**
 * ConfirmResetModal — 重新摸底二次确认弹窗
 *
 * Two-step confirmation before the user overwrites their existing
 * placement recommendation. Keeps the destructive action (re-doing
 * the survey) one click further away from the default reading flow.
 */

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export function ConfirmResetModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">重新摸底？</h2>
            <button
              onClick={onCancel}
              aria-label="关闭"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            重新摸底会覆盖你当前的推荐结果。确认要继续吗？
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 transition"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
            >
              重新摸底
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
