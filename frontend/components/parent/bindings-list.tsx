'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDateBeijing } from '@/lib/utils/date';

interface StudentBinding {
  id: string;
  parentVisitorId: string;
  createdAt: string;
}

interface ParentBinding {
  id: string;
  studentVisitorId: string;
  createdAt: string;
  label: string | null;
}

interface Props {
  /** "student" reads /api/parent/bindings?role=student (own device). */
  /** "parent" reads /api/parent/bindings?role=parent (other device). */
  role: 'student' | 'parent';
  title?: string;
  emptyText?: string;
}

/**
 * Renders the list of active bindings for the caller, with a
 * "revoke" button. The endpoint already enforces ownership so
 * a parent cannot revoke someone else's child and vice versa.
 */
export function BindingsList({ role, title, emptyText }: Props) {
  const [bindings, setBindings] = useState<
    StudentBinding[] | ParentBinding[] | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/parent/bindings?role=${role}`);
      const data = (await res.json()) as { success?: boolean; bindings?: unknown };
      if (data.success && Array.isArray(data.bindings)) {
        setBindings(data.bindings as StudentBinding[] | ParentBinding[]);
      } else {
        setBindings([]);
      }
    } catch {
      setBindings([]);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('确定要解除该绑定吗？')) {
      return;
    }
    setBusyId(id);
    try {
      await fetch(`/api/parent/bindings/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (bindings === null) return null;
  if (bindings.length === 0) {
    if (!emptyText) return null;
    return (
      <Card className="p-4">
        <p className="text-sm text-slate-500">{emptyText}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {title && (
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      )}
      <p className="mt-1 text-xs text-slate-400">
        解除绑定后，对方将无法继续查看你的学习看板。
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {bindings.map((b) => {
          const sub =
            role === 'student'
              ? (b as StudentBinding).parentVisitorId.slice(0, 6)
              : (b as ParentBinding).label ?? '孩子';
          const date = formatDateBeijing(b.createdAt);
          return (
            <li
              key={b.id}
              className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
            >
              <div className="text-sm text-slate-700">
                {role === 'student' ? '家长' : '孩子'} #{sub}
                <span className="ml-2 text-xs text-slate-400">
                  {date}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revoke(b.id)}
                disabled={busyId === b.id}
                className="text-rose-600 hover:text-rose-700"
              >
                {busyId === b.id ? '解除中…' : '解除绑定'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
