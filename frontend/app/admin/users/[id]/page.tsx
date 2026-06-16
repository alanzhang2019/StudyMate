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

type UserDetail = {
  id: string;
  email: string;
  createdAt: string;
  students: Student[];
  mistakeStats: { total: number; resolved: number };
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [mistakesLoading, setMistakesLoading] = useState(false);
  const [mistakesTotal, setMistakesTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) throw new Error(`Failed to fetch user (${res.status})`);
      const data = await res.json();
      setDetail(data);
      setEmailDraft(data.email);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
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
      if (!res.ok) throw new Error(`Failed to fetch mistakes (${res.status})`);
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

  const saveEmail = async () => {
    if (!id || !detail) return;
    if (!emailDraft.trim() || emailDraft === detail.email) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailDraft.trim() }),
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
      <div className="max-w-5xl mx-auto text-gray-500 py-8">Loading…</div>
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
        User not found.
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
            ← Back to users
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {detail.email}
          </h1>
          <p className="text-sm text-gray-500 font-mono">{detail.id}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setEmailDraft(detail.email);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={saveEmail} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit email
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                Delete user
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the user, all student profiles,
                  and all mistake records. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteUser}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">
            Students ({detail.students.length})
          </TabsTrigger>
          <TabsTrigger value="mistakes">
            Mistakes ({detail.mistakeStats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Email</label>
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
                <label className="text-sm text-gray-600">User ID</label>
                <div className="mt-1 text-gray-900 font-mono text-sm">
                  {detail.id}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600">Joined At</label>
                <div className="mt-1 text-gray-900">
                  {new Date(detail.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">Students</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {detail.students.length}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">Mistakes</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {detail.mistakeStats.total}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">Resolved</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {detail.mistakeStats.resolved}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Student Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.students.length === 0 ? (
                <div className="text-gray-500 py-4">
                  No student profiles yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-gray-600 text-sm">
                        <th className="py-3 px-4 font-semibold">Name</th>
                        <th className="py-3 px-4 font-semibold">Grade</th>
                        <th className="py-3 px-4 font-semibold">
                          Teaching Style
                        </th>
                        <th className="py-3 px-4 font-semibold">TTS Voice</th>
                        <th className="py-3 px-4 font-semibold">Created</th>
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
                            {new Date(s.createdAt).toLocaleDateString()}
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
                Recent Mistakes
                {mistakesTotal > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {mistakesTotal} total
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mistakesLoading ? (
                <div className="text-gray-500 py-4">Loading mistakes…</div>
              ) : mistakes.length === 0 ? (
                <div className="text-gray-500 py-4">
                  No mistake records for this user.
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
                            <Badge variant="outline">Unknown student</Badge>
                          )}
                          {m.isResolved ? (
                            <Badge>Resolved</Badge>
                          ) : (
                            <Badge variant="destructive">Unresolved</Badge>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Q: </span>
                        <span className="text-gray-900">{m.question}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Their answer: </span>
                        <span className="text-red-600">{m.userAnswer}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Correct: </span>
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
