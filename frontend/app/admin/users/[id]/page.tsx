'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDateTimeBeijing, formatDateBeijing } from '@/lib/utils/date';

type Student = {
  id: string;
  parentId: string;
  name: string;
  grade: string | null;
  teachingStyle: string | null;
  ttsVoice: string | null;
  createdAt: string;
};

type Mistake = {
  id: string;
  studentId: string;
  parentId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isResolved: number | boolean;
  createdAt: string;
  student: Student | null;
};

type CheckinRow = {
  classroomId: string;
  title: string;
  // 注意: coveragePct 已是百分比 (0-100), 不是 0-1 小数.
  // 后端用 evaluateCompletion 重新算的, 不再直接读 csp_progress
  // 表里只在 scene-complete 时才更新的旧字段.
  coveragePct: number;
  watchSeconds: number;
  lastViewedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  completed: boolean;
  // 该课件的随堂练习统计
  quiz: {
    totalQuizScenes: number;
    attemptedScenes: number;
    fullMarkScenes: number;
    totalQuestions: number;
    answeredQuestions: number;
    lastSubmittedAt: string | null;
  };
};

type CheckinStats = {
  total: number;
  completed: number;
  inProgress: number;
  totalWatchSeconds: number;
  lastActiveAt: string | null;
  // 随堂练习全课件汇总
  quiz: {
    totalScenes: number;
    attemptedScenes: number;
    fullMarkScenes: number;
    totalQuestions: number;
    answeredQuestions: number;
    lastSubmittedAt: string | null;
  };
};

type UserDetail = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  students: Student[];
  mistakeStats: { total: number; resolved: number };
  checkin: { stats: CheckinStats; rows: CheckinRow[] };
};

function formatWatchTime(seconds: number | undefined | null): string {
  const s = Number(seconds) || 0;
  if (s < 1) return '0 分钟';
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  const remain = mins % 60;
  return remain === 0 ? `${hours} 小时` : `${hours} 小时 ${remain} 分钟`;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [mistakesLoading, setMistakesLoading] = useState(false);
  const [mistakesTotal, setMistakesTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  // 重置密码弹窗
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  // 重置密码结果: 'ok' / 'err' 触发后短暂提示
  const [pwToast, setPwToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) throw new Error(`加载用户失败 (${res.status})`);
      const data = await res.json();
      setDetail(data);
      setEmailDraft(data.email);
      setNameDraft(data.name ?? '');
    } catch (err: any) {
      setError(err.message ?? '未知错误');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMistakes = useCallback(async () => {
    if (!id) return;
    setMistakesLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users/${id}/mistakes?limit=50&offset=0`,
      );
      if (!res.ok) throw new Error(`加载错题失败 (${res.status})`);
      const data = await res.json();
      setMistakes(data.items ?? []);
      setMistakesTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setMistakesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (activeTab === 'mistakes') loadMistakes();
  }, [activeTab, loadMistakes]);

  const saveEmailAndName = async () => {
    if (!id || !detail) return;
    const newEmail = emailDraft.trim();
    const newName = nameDraft.trim();
    const emailChanged = newEmail && newEmail !== detail.email;
    const nameChanged = newName !== (detail.name ?? '');
    if (!emailChanged && !nameChanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (emailChanged) body.email = newEmail;
      if (nameChanged) body.name = newName;
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await loadDetail();
      setEditing(false);
    } catch (err: any) {
      alert(`保存失败: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!id) return;
    if (newPassword.length < 6) {
      setPwToast({ kind: 'err', msg: '新密码至少 6 位' });
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setPwToast({ kind: 'ok', msg: '密码已重置，用户需用新密码重新登录' });
      setResetPwOpen(false);
      setNewPassword('');
      setTimeout(() => setPwToast(null), 4000);
    } catch (err: any) {
      setPwToast({ kind: 'err', msg: err.message ?? String(err) });
      setTimeout(() => setPwToast(null), 4000);
    } finally {
      setResetting(false);
    }
  };

  const deleteUser = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push('/admin/users');
    } catch (err: any) {
      alert(`删除失败: ${err.message ?? err}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto text-gray-500 py-8">正在加载…</div>
    );
  }
  if (error) {
    return (
      <div className="max-w-5xl mx-auto text-red-500 py-8">{error}</div>
    );
  }
  if (!detail) {
    return (
      <div className="max-w-5xl mx-auto text-gray-500 py-8">
        用户不存在
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/users')}
          >
            ← 返回用户列表
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {detail.name || detail.email}
          </h1>
          <p className="text-sm text-gray-500 font-mono">{detail.id}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setEmailDraft(detail.email);
                  setNameDraft(detail.name ?? '');
                }}
                disabled={saving}
              >
                取消
              </Button>
              <Button onClick={saveEmailAndName} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              编辑资料
            </Button>
          )}
          <AlertDialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" onClick={() => setResetPwOpen(true)}>
                重置密码
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>重置该用户密码？</AlertDialogTitle>
                <AlertDialogDescription>
                  请输入新密码（至少 6 位）。重置后该用户当前所有登录会话失效，需要用新密码重新登录。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <label className="text-sm text-gray-600">新密码</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1"
                  placeholder="至少 6 位"
                  autoFocus
                />
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-xs text-amber-600 mt-1">
                    至少 6 位
                  </p>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setResetPwOpen(false);
                    setNewPassword('');
                  }}
                >
                  取消
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={resetPassword}
                  disabled={resetting || newPassword.length < 6}
                >
                  {resetting ? '重置中…' : '确认重置'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                删除用户
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除该用户？</AlertDialogTitle>
                <AlertDialogDescription>
                  将永久删除该用户、其所有学生档案以及所有错题记录。此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={deleteUser}>
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {pwToast && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            pwToast.kind === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {pwToast.msg}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="checkin">
            打卡数据 ({detail.checkin.stats.total})
          </TabsTrigger>
          <TabsTrigger value="students">
            学生档案 ({detail.students.length})
          </TabsTrigger>
          <TabsTrigger value="mistakes">
            错题 ({detail.mistakeStats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>用户信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">姓名</label>
                {editing ? (
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="mt-1"
                    placeholder="可留空"
                  />
                ) : (
                  <div className="mt-1 text-gray-900">
                    {detail.name || (
                      <span className="text-gray-400">未填写</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">邮箱</label>
                {editing ? (
                  <Input
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-gray-900">{detail.email}</div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">用户ID</label>
                <div className="mt-1 text-gray-900 font-mono text-sm">
                  {detail.id}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600">注册时间</label>
                <div className="mt-1 text-gray-900">
                  {formatDateTimeBeijing(detail.createdAt)}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">已打卡</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {detail.checkin.stats.completed}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    共 {detail.checkin.stats.total} 个课件
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">学习时长</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {formatWatchTime(detail.checkin.stats.totalWatchSeconds)}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">错题数</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {detail.mistakeStats.total}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    已订正 {detail.mistakeStats.resolved}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">学生档案</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {detail.students.length}
                  </div>
                </div>
              </div>
              {/* 随堂练习 — 单独一行, 比上面 4 个卡片更细 (满分 / 已答 题目) */}
              <div className="rounded-lg border p-4 bg-blue-50/40">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm text-gray-500">随堂练习</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                      {detail.checkin.stats.quiz.attemptedScenes} / {detail.checkin.stats.quiz.totalScenes}{' '}
                      <span className="text-sm font-normal text-gray-500">场景已答</span>
                    </div>
                    {detail.checkin.stats.quiz.totalQuestions > 0 && (
                      <div className="text-xs text-gray-500 mt-1 tabular-nums">
                        题目 {detail.checkin.stats.quiz.answeredQuestions} /{' '}
                        {detail.checkin.stats.quiz.totalQuestions}
                        {' · '}
                        满分 {detail.checkin.stats.quiz.fullMarkScenes} 场景
                      </div>
                    )}
                  </div>
                  {detail.checkin.stats.quiz.lastSubmittedAt && (
                    <div className="text-xs text-gray-500">
                      最近交卷 {formatDateTimeBeijing(detail.checkin.stats.quiz.lastSubmittedAt)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkin">
          <Card>
            <CardHeader>
              <CardTitle>
                打卡数据
                {detail.checkin.rows.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    最近更新 {formatDateTimeBeijing(detail.checkin.stats.lastActiveAt ?? '')}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.checkin.rows.length === 0 ? (
                <div className="text-gray-500 py-4">
                  还没有开始任何 CSP 课件。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-gray-600 text-sm">
                        <th className="py-3 px-4 font-semibold">课件</th>
                        <th className="py-3 px-4 font-semibold">进度</th>
                        <th className="py-3 px-4 font-semibold">学习时长</th>
                        <th className="py-3 px-4 font-semibold">随堂练习</th>
                        <th className="py-3 px-4 font-semibold">状态</th>
                        <th className="py-3 px-4 font-semibold">最后活动</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.checkin.rows.map((r) => (
                        <tr
                          key={r.classroomId}
                          className="border-b last:border-0 hover:bg-gray-50/50"
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {r.title}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    r.completed
                                      ? 'bg-green-500'
                                      : 'bg-blue-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(100, Math.max(0, Number(r.coveragePct) || 0))}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 tabular-nums">
                                {Math.round(Number(r.coveragePct) || 0)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {formatWatchTime(r.watchSeconds)}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {r.quiz.totalQuizScenes > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="tabular-nums">
                                  {r.quiz.attemptedScenes} / {r.quiz.totalQuizScenes} 场景
                                </span>
                                {r.quiz.totalQuestions > 0 && (
                                  <span className="text-xs text-gray-500 tabular-nums">
                                    题目 {r.quiz.answeredQuestions} / {r.quiz.totalQuestions}
                                  </span>
                                )}
                                {r.quiz.fullMarkScenes > 0 && (
                                  <span className="text-xs text-green-600 tabular-nums">
                                    满分 {r.quiz.fullMarkScenes}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {r.completed ? (
                              <Badge>已打卡</Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                进行中
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {formatDateTimeBeijing(r.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>学生档案</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.students.length === 0 ? (
                <div className="text-gray-500 py-4">
                  还没有学生档案。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-gray-600 text-sm">
                        <th className="py-3 px-4 font-semibold">姓名</th>
                        <th className="py-3 px-4 font-semibold">年级</th>
                        <th className="py-3 px-4 font-semibold">
                          教学风格
                        </th>
                        <th className="py-3 px-4 font-semibold">TTS 音色</th>
                        <th className="py-3 px-4 font-semibold">创建时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.students.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b last:border-0 hover:bg-gray-50/50"
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {s.name}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {s.grade ?? '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {s.teachingStyle ?? '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                            {s.ttsVoice ?? '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {formatDateBeijing(s.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mistakes">
          <Card>
            <CardHeader>
              <CardTitle>
                最近错题
                {mistakesTotal > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    共 {mistakesTotal} 条
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mistakesLoading ? (
                <div className="text-gray-500 py-4">正在加载错题…</div>
              ) : mistakes.length === 0 ? (
                <div className="text-gray-500 py-4">
                  该用户还没有错题记录。
                </div>
              ) : (
                <div className="space-y-3">
                  {mistakes.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          {m.student ? (
                            <Badge variant="outline">
                              {m.student.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline">未关联学生</Badge>
                          )}
                          {m.isResolved ? (
                            <Badge>已订正</Badge>
                          ) : (
                            <Badge variant="destructive">未订正</Badge>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs">
                          {formatDateTimeBeijing(m.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">题目: </span>
                        <span className="text-gray-900">{m.question}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">用户答案: </span>
                        <span className="text-red-600">{m.userAnswer}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">正确答案: </span>
                        <span className="text-green-700">
                          {m.correctAnswer}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
