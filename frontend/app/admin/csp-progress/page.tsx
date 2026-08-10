'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  formatDateTimeBeijing,
  formatDateBeijing,
} from '@/lib/utils/date';

type Student = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  joinedAt: string;
  startedClassrooms: number;
  completedClassrooms: number;
  inProgressClassrooms: number;
  watchSeconds: number;
  lastActiveAt: string | null;
  lastClassroomId: string | null;
  lastClassroomTitle: string | null;
};

type Summary = {
  totalStudents: number;
  activeStudents: number;
  totalCompleted: number;
  totalWatchSeconds: number;
  totalClassrooms: number;
};

type SortKey =
  | 'name'
  | 'email'
  | 'joinedAt'
  | 'lastActiveAt'
  | 'startedClassrooms'
  | 'completedClassrooms'
  | 'watchSeconds';

function formatWatchTime(seconds: number): string {
  if (!seconds || seconds < 1) return '0 分钟';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins === 0 ? `${hours} 小时` : `${hours} 小时 ${remainMins} 分钟`;
}

export default function AdminCspProgressPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastActiveAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/csp-progress/overview');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          students: Student[];
          summary: Summary;
        };
        if (!cancelled) {
          setStudents(data.students);
          setSummary(data.summary);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.name ?? '').toLowerCase().includes(q) ||
        (s.lastClassroomTitle ?? '').toLowerCase().includes(q),
    );
  }, [students, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      // nulls / undefined go last regardless of dir
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), 'zh-Hans-CN');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Default: descending for date/numeric, ascending for text.
      setSortDir(
        key === 'name' || key === 'email' ? 'asc' : 'desc',
      );
    }
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => {
    const isActive = sortKey === k;
    return (
      <th
        className="py-3 px-4 font-semibold cursor-pointer select-none hover:text-gray-900"
        onClick={() => handleSort(k)}
      >
        <span className={isActive ? 'text-gray-900' : 'text-gray-600'}>
          {label}
          {isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </span>
      </th>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            全部学生打卡进度
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            汇总每个 <code>role=student</code> 账号在 CSP 课件上的观看与完成情况。
            计入"已完成"的条件：<code>coveragePct ≥ 80%</code> 且所有 quiz 场景满分（与 /student/home 一致）。
          </p>
        </div>
        <Badge variant="secondary">
          {students.length} 个学生账号
        </Badge>
      </div>

      {loading ? (
        <div className="text-gray-500 py-8">正在加载学生进度…</div>
      ) : error ? (
        <div className="text-red-500 py-8">{error}</div>
      ) : (
        <>
          {/* Summary cards: 4 KPIs that give the teacher a one-glance
              sense of the cohort. Mirrors the cards on /admin
              (Dashboard) for visual consistency. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">学生总数</div>
                <div className="text-3xl font-semibold text-gray-900 mt-1">
                  {summary?.totalStudents ?? 0}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  注册时选 "学生" 角色的账号
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">
                  活跃学生（已开始过任一课件）
                </div>
                <div className="text-3xl font-semibold text-gray-900 mt-1">
                  {summary?.activeStudents ?? 0}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {summary && summary.totalStudents > 0
                    ? `${Math.round(
                        (summary.activeStudents /
                          summary.totalStudents) *
                          100,
                      )}% 已启动`
                    : '0%'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">累计打卡次数</div>
                <div className="text-3xl font-semibold text-gray-900 mt-1">
                  {summary?.totalCompleted ?? 0}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  共 {summary?.totalClassrooms ?? 0} 个课件可选
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">累计学习时长</div>
                <div className="text-3xl font-semibold text-gray-900 mt-1">
                  {formatWatchTime(summary?.totalWatchSeconds ?? 0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  来自 /api/csp-progress/heartbeat 30 秒上报
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>学生列表</CardTitle>
                <div className="w-full sm:w-72">
                  <Input
                    placeholder="按邮箱 / 姓名 / 课件名搜索…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sorted.length === 0 ? (
                <div className="text-gray-500 py-6 text-center">
                  {query
                    ? '没有匹配的学生。'
                    : '还没有学生注册。等用户通过 /csp-lecture 注册学生账号后再来查看。'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-sm">
                        <SortHeader k="name" label="姓名" />
                        <SortHeader k="email" label="邮箱" />
                        <SortHeader k="joinedAt" label="注册时间" />
                        <th className="py-3 px-4 font-semibold text-gray-600">
                          最近活动
                        </th>
                        <SortHeader k="startedClassrooms" label="已开" />
                        <SortHeader k="completedClassrooms" label="打卡" />
                        <SortHeader k="watchSeconds" label="累计时长" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b last:border-0 hover:bg-gray-50/50"
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {s.name || (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {s.email}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {formatDateBeijing(s.joinedAt)}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {s.lastActiveAt ? (
                              <div className="flex flex-col">
                                <span className="text-gray-700">
                                  {formatDateTimeBeijing(s.lastActiveAt)}
                                </span>
                                {s.lastClassroomTitle && (
                                  <span className="text-xs text-gray-500 truncate max-w-[14rem]">
                                    《{s.lastClassroomTitle}》
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-gray-400">
                                从未开始
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {s.startedClassrooms}
                            {s.inProgressClassrooms > 0 && (
                              <span className="text-xs text-amber-600 ml-1">
                                ({s.inProgressClassrooms} 进行中)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {s.completedClassrooms > 0 ? (
                              <Badge>{s.completedClassrooms}</Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {formatWatchTime(s.watchSeconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
