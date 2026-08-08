'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeBeijing } from '@/lib/utils/date';

type CheckinStats = {
  total: number;
  completed: number;
  inProgress: number;
  totalWatchSeconds: number;
  lastActiveAt: string | null;
};

type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  _count: { profiles: number };
  // 由 /api/admin/users?[with=checkin] 注入, 否则 undefined
  checkin?: CheckinStats;
};

const PAGE_SIZE = 10;

// 把 watchSeconds 格式化为 "X 小时 Y 分钟" / "Y 分钟"
function formatWatchTime(seconds: number | undefined | null): string {
  const s = Number(seconds) || 0;
  if (s < 1) return '0 分钟';
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  const remain = mins % 60;
  return remain === 0 ? `${hours} 小时` : `${hours} 小时 ${remain} 分钟`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // ?with=checkin 让 API 同时返回每个用户的打卡聚合, 避免列表 + 详情来回切时再请求.
        const res = await fetch('/api/admin/users?with=checkin');
        if (!res.ok) throw new Error('加载用户失败');
        const data = await res.json();
        if (!cancelled) setUsers(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? '未知错误');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  // 客户端过滤: 搜索框匹配姓名 / 邮箱 / 用户ID
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }, [users, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
        <Badge variant="secondary">
          当前页 {currentPage} / {totalPages} · 共 {users.length} 个
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>已注册用户</CardTitle>
            <div className="w-full sm:w-72">
              <Input
                placeholder="按姓名 / 邮箱 / 用户ID搜索…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500 py-4">正在加载用户…</div>
          ) : error ? (
            <div className="text-red-500 py-4">{error}</div>
          ) : paged.length === 0 ? (
            <div className="text-gray-500 py-4">
              {query ? '没有匹配的用户。' : '还没有任何用户注册。'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-gray-600 text-sm">
                    <th className="py-3 px-4 font-semibold">姓名</th>
                    <th className="py-3 px-4 font-semibold">邮箱</th>
                    <th className="py-3 px-4 font-semibold">角色</th>
                    <th className="py-3 px-4 font-semibold">学生档案</th>
                    <th className="py-3 px-4 font-semibold">已打卡</th>
                    <th className="py-3 px-4 font-semibold">学习时长</th>
                    <th className="py-3 px-4 font-semibold">最近活动</th>
                    <th className="py-3 px-4 font-semibold">注册时间</th>
                    <th className="py-3 px-4 font-semibold text-right">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((user) => {
                    const c = user.checkin;
                    return (
                      <tr
                        key={user.id}
                        className="border-b last:border-0 hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => router.push(`/admin/users/${user.id}`)}
                      >
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {user.name || (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-700 text-sm">
                          {user.email}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {user._count.profiles > 0 ? (
                            <Badge variant="outline">家长</Badge>
                          ) : (
                            <Badge>学生</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {user._count.profiles}
                        </td>
                        <td className="py-3 px-4">
                          {c && c.completed > 0 ? (
                            <Badge>{c.completed}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                          {c && c.inProgress > 0 && (
                            <span className="text-xs text-amber-600 ml-1">
                              ({c.inProgress} 进行中)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-700 text-sm">
                          {formatWatchTime(c?.totalWatchSeconds ?? 0)}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-sm">
                          {c?.lastActiveAt ? (
                            formatDateTimeBeijing(c.lastActiveAt)
                          ) : (
                            <span className="text-gray-400">从未开始</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-sm">
                          {formatDateTimeBeijing(user.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/users/${user.id}`);
                            }}
                          >
                            查看
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <div>
                第 {currentPage} 页 / 共 {totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
