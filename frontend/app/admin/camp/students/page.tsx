'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Student = {
  id: string;
  name: string;
  gender: string | null; // '男' | '女' | '' | null
  grade: string | null;
  school: string | null;
  parentName: string | null;
  parentPhone: string | null;
  className: string | null;
  tags: string[];
  notes: string | null;
  status: 'active' | 'dropped' | 'graduated';
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'active', label: '在读' },
  { value: 'dropped', label: '停课' },
  { value: 'graduated', label: '结业' },
];

const STATUS_PILL: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  dropped: 'bg-red-100 text-red-700 border-red-200',
  graduated: 'bg-gray-100 text-gray-700 border-gray-200',
};

const STATUS_LABEL: Record<string, string> = {
  active: '在读',
  dropped: '停课',
  graduated: '结业',
};

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
}

export default function AdminCampStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  // debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedQ(searchQ.trim());
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQ]);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      if (statusFilter) params.set('status', statusFilter);
      if (classFilter.trim()) params.set('className', classFilter.trim());

      const res = await fetch(
        `/api/admin/camp/students${params.toString() ? '?' + params.toString() : ''}`,
      );
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取失败');
      setStudents(json.data ?? []);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, classFilter, statusFilter]);

  const submitStudent = async (formData: Record<string, any>) => {
    try {
      const tags =
        typeof formData.tagsText === 'string'
          ? formData.tagsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const body: any = {
        name: formData.name,
        gender: formData.gender,
        grade: formData.grade,
        school: formData.school,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        className: formData.className,
        notes: formData.notes,
        status: formData.status || 'active',
        tags,
      };

      let res: Response;
      if (editingStudent) {
        res = await fetch(`/api/admin/camp/students/${editingStudent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admin/camp/students', {
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
      alert(editingStudent ? '已更新学员' : '已创建学员');
      setShowForm(false);
      setEditingStudent(null);
      loadList();
    } catch (e: any) {
      alert(e?.message || '保存失败');
    }
  };

  const doDelete = async () => {
    if (!deletingStudent) return;
    try {
      const res = await fetch(
        `/api/admin/camp/students/${deletingStudent.id}`,
        { method: 'DELETE' },
      );
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
      setDeletingStudent(null);
      loadList();
    } catch (e: any) {
      alert(e?.message || '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">学员管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {students.length} 名学员
          </p>
        </div>
        <button
          onClick={() => {
            setEditingStudent(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
        >
          ＋ 新增学员
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">
            搜索：
          </label>
          <input
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-48"
            placeholder="按姓名搜索…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">
            班级：
          </label>
          <input
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-40"
            placeholder="班级名"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">
            状态：
          </label>
          <select
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中…</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">👶</div>
            <div className="text-gray-500 text-lg">暂无学员数据</div>
            <div className="text-gray-400 text-sm mt-1">
              点击右上角「＋ 新增学员」开始添加
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="py-3 px-4 font-semibold">姓名</th>
                  <th className="py-3 px-4 font-semibold">性别</th>
                  <th className="py-3 px-4 font-semibold">年级</th>
                  <th className="py-3 px-4 font-semibold">学校</th>
                  <th className="py-3 px-4 font-semibold">家长姓名</th>
                  <th className="py-3 px-4 font-semibold">家长电话</th>
                  <th className="py-3 px-4 font-semibold">班级</th>
                  <th className="py-3 px-4 font-semibold">标签</th>
                  <th className="py-3 px-4 font-semibold">状态</th>
                  <th className="py-3 px-4 font-semibold">最近更新</th>
                  <th className="py-3 px-4 font-semibold text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {s.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {s.gender || (
                        <span className="text-gray-400">未填</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {s.grade || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-[160px] truncate">
                      {s.school || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {s.parentName || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {s.parentPhone || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {s.className || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {s.tags && s.tags.length > 0 ? (
                          s.tags.map((t) => (
                            <span
                              key={t}
                              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          STATUS_PILL[s.status] || STATUS_PILL.active
                        }`}
                      >
                        {STATUS_LABEL[s.status] || s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {fmt(s.updatedAt || s.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingStudent(s);
                          setShowForm(true);
                        }}
                        className="px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 mr-1"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => {
                          setDeletingStudent(s);
                          setShowDelete(true);
                        }}
                        className="px-2.5 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <StudentFormModal
          initial={editingStudent}
          onClose={() => {
            setShowForm(false);
            setEditingStudent(null);
          }}
          onSubmit={submitStudent}
        />
      )}

      {/* Delete confirm */}
      {showDelete && deletingStudent && (
        <Overlay onClose={() => setShowDelete(false)}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            确认删除学员？
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            即将删除
            <span className="font-medium mx-1 text-gray-800">
              「{deletingStudent.name}」
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

function StudentFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: Student | null;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    gender: initial?.gender ?? '',
    grade: initial?.grade ?? '',
    school: initial?.school ?? '',
    parentName: initial?.parentName ?? '',
    parentPhone: initial?.parentPhone ?? '',
    className: initial?.className ?? '',
    tagsText: (initial?.tags ?? []).join(', '),
    notes: initial?.notes ?? '',
    status: initial?.status ?? 'active',
  });

  const setField = (k: string, v: any) =>
    setForm((f) => ({ ...(f as any), [k]: v }));

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {initial ? '编辑学员' : '新增学员'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            姓名 <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            性别
          </label>
          <div className="flex items-center gap-4 py-2">
            {[
              { v: '男', l: '男' },
              { v: '女', l: '女' },
              { v: '', l: '未填' },
            ].map((o) => (
              <label
                key={o.v}
                className="inline-flex items-center gap-1 cursor-pointer text-sm"
              >
                <input
                  type="radio"
                  name="gender"
                  checked={form.gender === o.v}
                  onChange={() => setField('gender', o.v)}
                  className="w-4 h-4"
                />
                {o.l}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            年级
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="如：三年级"
            value={form.grade}
            onChange={(e) => setField('grade', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            学校
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.school}
            onChange={(e) => setField('school', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            家长姓名
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.parentName}
            onChange={(e) => setField('parentName', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            家长电话
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.parentPhone}
            onChange={(e) => setField('parentPhone', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            班级
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.className}
            onChange={(e) => setField('className', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            状态
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.status}
            onChange={(e) => setField('status', e.target.value)}
          >
            {STATUS_OPTIONS.filter((o) => o.value !== '').map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            标签（逗号分隔）
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="如：动手能力强, 表达好, Python"
            value={form.tagsText}
            onChange={(e) => setField('tagsText', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            备注
          </label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={4}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
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
            if (!form.name.trim()) {
              alert('请输入学员姓名');
              return;
            }
            onSubmit(form);
          }}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          {initial ? '保存修改' : '创建学员'}
        </button>
      </div>
    </Overlay>
  );
}
