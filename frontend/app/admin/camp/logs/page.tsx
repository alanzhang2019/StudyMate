'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ClassLog = {
  id: string;
  classDate: string; // YYYY-MM-DD
  className: string;
  teacherName: string;
  topic: string;
  durationMin: number | null;
  studentIds: string[];
  summary: string | null;
  highlights: string[];
  issues: string[];
  nextPlan: string | null;
  createdAt: string;
  updatedAt: string;
};

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
}

function formatDate(d: string) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const day = dt.getDate();
    const w = ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()];
    return { y, m, day, w };
  } catch {
    return { y: '', m: '', day: '', w: '' };
  }
}

export default function AdminCampLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ClassLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classFilter, setClassFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<ClassLog | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deletingLog, setDeletingLog] = useState<ClassLog | null>(null);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (classFilter.trim()) params.set('className', classFilter.trim());

      const res = await fetch(
        `/api/admin/camp/logs${params.toString() ? '?' + params.toString() : ''}`,
      );
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取失败');
      setLogs(json.data ?? []);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFilter]);

  const submitLog = async (formData: Record<string, any>) => {
    try {
      const studentIds =
        typeof formData.studentIdsText === 'string'
          ? formData.studentIdsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const highlights =
        typeof formData.highlightsText === 'string'
          ? formData.highlightsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const issues =
        typeof formData.issuesText === 'string'
          ? formData.issuesText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const body: any = {
        classDate: formData.classDate,
        className: formData.className,
        teacherName: formData.teacherName,
        topic: formData.topic,
        durationMin:
          formData.durationMin === '' || formData.durationMin === undefined
            ? ''
            : Number(formData.durationMin),
        studentIds,
        summary: formData.summary,
        highlights,
        issues,
        nextPlan: formData.nextPlan,
      };

      let res: Response;
      if (editingLog) {
        res = await fetch(`/api/admin/camp/logs/${editingLog.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admin/camp/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const json = await res.json();
      if (!json.success) {
        alert(json.error || '保存失败');
        return;
      }
      alert(editingLog ? '已更新课堂记录' : '已创建课堂记录');
      setShowForm(false);
      setEditingLog(null);
      loadList();
    } catch (e: any) {
      alert(e?.message || '保存失败');
    }
  };

  const doDelete = async () => {
    if (!deletingLog) return;
    try {
      const res = await fetch(`/api/admin/camp/logs/${deletingLog.id}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const json = await res.json();
      if (!json.success) {
        alert(json.error || '删除失败');
        return;
      }
      alert('已删除');
      setShowDelete(false);
      setDeletingLog(null);
      loadList();
    } catch (e: any) {
      alert(e?.message || '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">课堂记录</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {logs.length} 条记录 · 按日期倒序
          </p>
        </div>
        <button
          onClick={() => {
            setEditingLog(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
        >
          ＋ 新建课堂记录
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">
            班级：
          </label>
          <input
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-48"
            placeholder="输入班级名"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          加载中…
        </div>
      ) : error ? (
        <div className="bg-white border rounded-lg p-8 text-center text-red-500">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <div className="text-5xl mb-3">📝</div>
          <div className="text-gray-500 text-lg">暂无课堂记录</div>
          <div className="text-gray-400 text-sm mt-1">
            点击右上角「＋ 新建课堂记录」开始记录
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const d = formatDate(log.classDate);
            return (
              <div
                key={log.id}
                className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition flex flex-col sm:flex-row"
              >
                {/* Left: date */}
                <div className="sm:w-28 bg-gray-50 border-b sm:border-b-0 sm:border-r flex sm:flex-col items-center justify-center p-4 text-center">
                  <div className="text-xs text-gray-500 mr-2 sm:mr-0 sm:mb-1">
                    {d.y}
                  </div>
                  <div className="text-4xl font-bold text-gray-800">
                    {d.m}月{d.day}日
                  </div>
                  <div className="text-xs text-gray-500 ml-2 sm:ml-0 sm:mt-1">
                    周{d.w}
                  </div>
                </div>

                {/* Right: content */}
                <div className="flex-1 p-5 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {log.topic}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          班级：{log.className}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                          老师：{log.teacherName}
                        </span>
                        {log.durationMin ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">
                            ⏱ {log.durationMin} 分钟
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        更新于 {fmt(log.updatedAt || log.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingLog(log);
                          setShowForm(true);
                        }}
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => {
                          setDeletingLog(log);
                          setShowDelete(true);
                        }}
                        className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  {/* Students */}
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-1">
                      到场学员（{log.studentIds?.length ?? 0}）
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(log.studentIds ?? []).length > 0 ? (
                        log.studentIds.map((sid) => (
                          <span
                            key={sid}
                            className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"
                          >
                            {sid}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">暂无记录</span>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  {log.summary && (
                    <div>
                      <div className="text-xs text-gray-500 font-medium mb-1">
                        课堂小结
                      </div>
                      <div className="text-sm text-gray-700 bg-gray-50 border rounded p-3 whitespace-pre-wrap">
                        {log.summary}
                      </div>
                    </div>
                  )}

                  {/* Highlights / Issues */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(log.highlights ?? []).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 font-medium mb-1">
                          亮点 ✨
                        </div>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                          {log.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(log.issues ?? []).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 font-medium mb-1">
                          待改进 💡
                        </div>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                          {log.issues.map((iss, i) => (
                            <li key={i}>{iss}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Next plan */}
                  {log.nextPlan && (
                    <div>
                      <div className="text-xs text-gray-500 font-medium mb-1">
                        下节课计划
                      </div>
                      <div className="text-sm text-gray-700 bg-blue-50/40 border border-blue-100 rounded p-3 whitespace-pre-wrap">
                        {log.nextPlan}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <LogFormModal
          initial={editingLog}
          onClose={() => {
            setShowForm(false);
            setEditingLog(null);
          }}
          onSubmit={submitLog}
        />
      )}

      {/* Delete confirm */}
      {showDelete && deletingLog && (
        <Overlay onClose={() => setShowDelete(false)}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            确认删除课堂记录？
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            即将删除
            <span className="font-medium mx-1 text-gray-800">
              「{deletingLog.classDate} · {deletingLog.topic}」
            </span>
            ，此操作不可恢复。
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowDelete(false)}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={doDelete}
              className="px-4 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-600"
            >
              删除
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function LogFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: ClassLog | null;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void;
}) {
  const [form, setForm] = useState({
    classDate: initial?.classDate ?? '',
    className: initial?.className ?? '',
    teacherName: initial?.teacherName ?? '',
    topic: initial?.topic ?? '',
    durationMin:
      initial?.durationMin === undefined || initial?.durationMin === null
        ? ''
        : String(initial.durationMin),
    studentIdsText: (initial?.studentIds ?? []).join(', '),
    summary: initial?.summary ?? '',
    highlightsText: (initial?.highlights ?? []).join('\n'),
    issuesText: (initial?.issues ?? []).join('\n'),
    nextPlan: initial?.nextPlan ?? '',
  });

  const setField = (k: string, v: any) =>
    setForm((f) => ({ ...(f as any), [k]: v }));

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {initial ? '编辑课堂记录' : '新建课堂记录'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            日期 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.classDate}
            onChange={(e) => setField('classDate', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            时长（分钟）
          </label>
          <input
            type="number"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="如 60"
            value={form.durationMin}
            onChange={(e) => setField('durationMin', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            班级 <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.className}
            onChange={(e) => setField('className', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            授课老师 <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.teacherName}
            onChange={(e) => setField('teacherName', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            主题 <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.topic}
            onChange={(e) => setField('topic', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            到场学员（逗号分隔）
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="如 ID_001, ID_002, 小明, 小红"
            value={form.studentIdsText}
            onChange={(e) => setField('studentIdsText', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            课堂小结
          </label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={4}
            value={form.summary}
            onChange={(e) => setField('summary', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            亮点（每行一项）
          </label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={4}
            placeholder={"专注度高\n完成了作品展示"}
            value={form.highlightsText}
            onChange={(e) => setField('highlightsText', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            待改进（每行一项）
          </label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={4}
            placeholder={"打字速度可提高\n注意代码规范"}
            value={form.issuesText}
            onChange={(e) => setField('issuesText', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            下节课计划
          </label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            value={form.nextPlan}
            onChange={(e) => setField('nextPlan', e.target.value)}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onClick={() => {
            if (!form.classDate) {
              alert('请选择日期');
              return;
            }
            if (!form.className.trim()) {
              alert('请填写班级');
              return;
            }
            if (!form.teacherName.trim()) {
              alert('请填写授课老师');
              return;
            }
            if (!form.topic.trim()) {
              alert('请填写主题');
              return;
            }
            onSubmit(form);
          }}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          {initial ? '保存修改' : '创建记录'}
        </button>
      </div>
    </Overlay>
  );
}
