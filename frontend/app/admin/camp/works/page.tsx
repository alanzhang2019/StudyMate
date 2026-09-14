'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Work = {
  id: string;
  title: string;
  studentId: string;
  studentName: string | null;
  className: string | null;
  classLogId: string | null;
  category: string | null;
  coverImage: string | null;
  linkUrl: string | null;
  description: string | null;
  techStack: string[];
  status: 'pending' | 'approved' | 'rejected';
  featured: number;
  sortOrder: number;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  processLog: ProcessLogEntry[];
  ability: AbilityAssessment | null;
  teacherComment: string | null;
  introVideoFile: string | null;
  introVideoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProcessLogEntry = {
  time: string;
  tag: string;
  image: string;
  title: string;
  description: string;
};

type AbilityAssessment = {
  heading: string;
  intro: string;
  note: string;
  scores: number[];
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

type Student = {
  id: string;
  name: string;
  className: string | null;
};

const STATUS_LABEL: Record<StatusFilter | string, string> = {
  all: '全部',
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

const STATUS_PILL: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const CATEGORY_OPTIONS = [
  { value: '', label: '全部' },
  { value: '作品', label: '作品' },
  { value: '项目', label: '项目' },
  { value: '代码', label: '代码' },
  { value: '其他', label: '其他' },
];

// 能力评估五维（与作品详情页雷达图标签顺序一致）。
const ABILITY_LABELS = ['创造力', '逻辑', '表达', '协作', '审美'];

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
}

export default function AdminCampWorksPage() {
  const router = useRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [classFilter, setClassFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Form / modals
  const [showForm, setShowForm] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);

  const [showReview, setShowReview] = useState(false);
  const [reviewingWork, setReviewingWork] = useState<Work | null>(null);
  const [reviewStatus, setReviewStatus] =
    useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');

  const [showDelete, setShowDelete] = useState(false);
  const [deletingWork, setDeletingWork] = useState<Work | null>(null);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (classFilter.trim()) params.set('className', classFilter.trim());
      if (categoryFilter.trim()) params.set('category', categoryFilter.trim());

      const res = await fetch(
        `/api/admin/camp/works${params.toString() ? '?' + params.toString() : ''}`,
      );
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '获取失败');
      setWorks(json.data ?? []);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, classFilter, categoryFilter]);

  const loadStudents = async () => {
    try {
      const res = await fetch('/api/admin/camp/students?status=active&pageSize=500');
      if (!res.ok) return;
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setStudents(
          json.data.map((s: any) => ({
            id: s.id,
            name: s.name,
            className: s.className ?? null,
          })),
        );
      }
    } catch {
      // 学员列表加载失败不影响作品管理主流程
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const submitWork = async (formData: Record<string, any>) => {
    try {
      const techStack =
        typeof formData.techStackText === 'string'
          ? formData.techStackText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const body: any = {
        title: formData.title,
        studentId: formData.studentId,
        studentName: formData.studentName,
        className: formData.className,
        classLogId: formData.classLogId,
        category: formData.category,
        coverImage: formData.coverImage,
        linkUrl: formData.linkUrl,
        description: formData.description,
        techStack,
        featured: formData.featured ? 1 : 0,
        sortOrder: Number(formData.sortOrder) || 0,
        processLog: formData.processLog ?? [],
        ability: formData.ability ?? null,
        teacherComment: formData.teacherComment ?? '',
        introVideoFile: formData.introVideoFile || null,
        introVideoUrl: formData.introVideoUrl || null,
      };

      let res: Response;
      if (editingWork) {
        res = await fetch(`/api/admin/camp/works/${editingWork.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admin/camp/works', {
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
      alert(editingWork ? '已更新作品' : '已创建作品');
      setShowForm(false);
      setEditingWork(null);
      loadList();
    } catch (e: any) {
      alert(e?.message || '保存失败');
    }
  };

  const updateStatus = async (
    work: Work,
    status: 'approved' | 'rejected',
    note: string,
  ) => {
    try {
      const res = await fetch(`/api/admin/camp/works/${work.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNote: note || null }),
      });
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const json = await res.json();
      if (!json.success) {
        alert(json.error || '操作失败');
        return;
      }
      alert(status === 'approved' ? '已通过审核' : '已拒绝');
      loadList();
    } catch (e: any) {
      alert(e?.message || '操作失败');
    }
  };

  const toggleFeatured = async (work: Work) => {
    try {
      const res = await fetch(`/api/admin/camp/works/${work.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: work.featured ? 0 : 1 }),
      });
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const json = await res.json();
      if (!json.success) {
        alert(json.error || '操作失败');
        return;
      }
      loadList();
    } catch (e: any) {
      alert(e?.message || '操作失败');
    }
  };

  const doDelete = async () => {
    if (!deletingWork) return;
    try {
      const res = await fetch(`/api/admin/camp/works/${deletingWork.id}`, {
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
      setDeletingWork(null);
      loadList();
    } catch (e: any) {
      alert(e?.message || '删除失败');
    }
  };

  const counts = useMemo(() => {
    return {
      total: works.length,
      pending: works.filter((w) => w.status === 'pending').length,
      approved: works.filter((w) => w.status === 'approved').length,
      rejected: works.filter((w) => w.status === 'rejected').length,
    };
  }, [works]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">作品审核</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {counts.total} 个 · 待审核 {counts.pending} · 已通过{' '}
            {counts.approved} · 已拒绝 {counts.rejected}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingWork(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
        >
          ＋ 新增作品
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-1 border-b">
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                  statusFilter === s
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {STATUS_LABEL[s]}
                {s !== 'all' && (
                  <span className="ml-1 text-xs text-gray-400">
                    ({counts[s as 'pending' | 'approved' | 'rejected']})
                  </span>
                )}
              </button>
            ),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">
              班级：
            </label>
            <input
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="输入班级名"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">
              类型：
            </label>
            <select
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          加载中…
        </div>
      ) : error ? (
        <div className="bg-white border rounded-lg p-8 text-center text-red-500">
          {error}
        </div>
      ) : works.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <div className="text-5xl mb-3">🖼️</div>
          <div className="text-gray-500 text-lg">暂无作品数据</div>
          <div className="text-gray-400 text-sm mt-1">
            试试调整筛选条件，或点击右上角「＋ 新增作品」
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {works.map((w) => (
            <div
              key={w.id}
              className="bg-white border rounded-lg overflow-hidden flex flex-col hover:shadow-md transition"
            >
              <div className="relative">
                {w.coverImage ? (
                  <img
                    src={w.coverImage}
                    alt={w.title}
                    className="w-full h-40 object-cover bg-gray-100"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                    <svg
                      className="w-16 h-16 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <span
                  className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border font-medium ${
                    STATUS_PILL[w.status] ||
                    'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {STATUS_LABEL[w.status] || w.status}
                </span>
                {w.featured ? (
                  <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                    ★ 精选
                  </span>
                ) : null}
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-gray-900 text-base line-clamp-1">
                  {w.title}
                </h3>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <div>
                    👤 {w.studentName || w.studentId}
                    {w.studentName && w.studentName !== w.studentId ? (
                      <span className="text-xs text-gray-400 ml-1">
                        (ID: {w.studentId})
                      </span>
                    ) : null}
                  </div>
                  <div>
                    🏫 {w.className || '—'} · 📁 {w.category || '—'}
                  </div>
                </div>
                {w.techStack && w.techStack.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.techStack.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                      >
                        {t}
                      </span>
                    ))}
                    {w.techStack.length > 6 && (
                      <span className="text-xs text-gray-400">
                        +{w.techStack.length - 6}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-4 flex flex-wrap gap-2">
                  {w.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setReviewingWork(w);
                          setReviewStatus('approved');
                          setReviewNote('');
                          setShowReview(true);
                        }}
                        className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => {
                          setReviewingWork(w);
                          setReviewStatus('rejected');
                          setReviewNote('');
                          setShowReview(true);
                        }}
                        className="px-3 py-1.5 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition"
                      >
                        拒绝
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => toggleFeatured(w)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition ${
                      w.featured
                        ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {w.featured ? '取消精选' : '精选'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingWork(w);
                      setShowForm(true);
                    }}
                    className="px-3 py-1.5 text-sm rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => {
                      setDeletingWork(w);
                      setShowDelete(true);
                    }}
                    className="px-3 py-1.5 text-sm rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <WorkFormModal
          initial={editingWork}
          students={students}
          onClose={() => {
            setShowForm(false);
            setEditingWork(null);
          }}
          onSubmit={submitWork}
        />
      )}

      {/* Review Modal */}
      {showReview && reviewingWork && (
        <Overlay onClose={() => setShowReview(false)}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            审核 · {reviewingWork.title}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                审核结果
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={reviewStatus}
                onChange={(e) =>
                  setReviewStatus(e.target.value as 'approved' | 'rejected')
                }
              >
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                审核备注
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                rows={4}
                placeholder="请输入审核备注（可选）"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setShowReview(false)}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={() => {
                updateStatus(reviewingWork, reviewStatus, reviewNote);
                setShowReview(false);
                setReviewingWork(null);
              }}
              className={`px-4 py-2 text-sm rounded-md text-white ${
                reviewStatus === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              确认{reviewStatus === 'approved' ? '通过' : '拒绝'}
            </button>
          </div>
        </Overlay>
      )}

      {/* Delete confirm */}
      {showDelete && deletingWork && (
        <Overlay onClose={() => setShowDelete(false)}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            确认删除作品？
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            即将删除
            <span className="font-medium mx-1 text-gray-800">
              「{deletingWork.title}」
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

/* ---------- 通用 Overlay ---------- */
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

/* ---------- 作品表单 Modal ---------- */
function WorkFormModal({
  initial,
  onClose,
  onSubmit,
  students,
}: {
  initial: Work | null;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void;
  students: Student[];
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    studentId: initial?.studentId ?? '',
    studentName: initial?.studentName ?? '',
    className: initial?.className ?? '',
    classLogId: initial?.classLogId ?? '',
    category: initial?.category ?? '',
    coverImage: initial?.coverImage ?? '',
    linkUrl: initial?.linkUrl ?? '',
    description: initial?.description ?? '',
    techStackText: (initial?.techStack ?? []).join(', '),
    featured: !!initial?.featured,
    sortOrder: initial?.sortOrder ?? 0,
    teacherComment: initial?.teacherComment ?? '',
    introVideoFile: initial?.introVideoFile ?? '',
    introVideoUrl: initial?.introVideoUrl ?? '',
    ability: {
      heading: initial?.ability?.heading ?? '',
      intro: initial?.ability?.intro ?? '',
      note: initial?.ability?.note ?? '',
      scores: initial?.ability?.scores?.length === 5
        ? initial.ability.scores
        : [7, 7, 7, 7, 7],
    },
    processLog: (initial?.processLog ?? []) as ProcessLogEntry[],
  });

  const setField = (k: string, v: any) =>
    setForm((f) => ({ ...(f as any), [k]: v }));

  // 上传作品介绍视频到服务器（仅编辑已有作品时可用，需 work.id）。
  const [uploading, setUploading] = useState(false);
  const uploadVideo = async (file: File) => {
    if (!initial?.id) {
      alert('请先保存作品，再上传视频');
      return;
    }
    if (
      !/^video\//.test(file.type) &&
      !/\.(mp4|webm|mov|m4v)$/i.test(file.name)
    ) {
      alert('仅支持 mp4 / webm / mov / m4v 格式');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      alert('视频不能超过 200MB');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      const res = await fetch(`/api/admin/camp/works/${initial.id}/video`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || '上传失败');
        return;
      }
      setForm((f) => ({ ...f, introVideoFile: json.data.url, introVideoUrl: '' }));
      alert('视频上传成功');
    } catch (e: any) {
      alert(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 上传创作记录第 i 条的过程截图。
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(null);
  const uploadProcessImage = async (i: number, file: File) => {
    if (!initial?.id) {
      alert('请先保存作品，再上传图片');
      return;
    }
    if (
      !/^image\//.test(file.type) &&
      !/\.(png|jpe?g|webp|gif)$/i.test(file.name)
    ) {
      alert('仅支持 png / jpg / jpeg / webp / gif 格式');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('图片不能超过 20MB');
      return;
    }
    setUploadingImageIdx(i);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`/api/admin/camp/works/${initial.id}/image`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || '上传失败');
        return;
      }
      updateProcessLog(i, 'image', json.data.url);
      alert('图片上传成功');
    } catch (e: any) {
      alert(e?.message || '上传失败');
    } finally {
      setUploadingImageIdx(null);
    }
  };

  // 更新创作记录第 i 条的某个字段。
  const updateProcessLog = (
    i: number,
    field: keyof ProcessLogEntry,
    value: string,
  ) => {
    setForm((f) => {
      const next = f.processLog.map((entry, idx) =>
        idx === i ? { ...entry, [field]: value } : entry,
      );
      return { ...f, processLog: next };
    });
  };

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {initial ? '编辑作品' : '新增作品'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            标题 <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            学员 <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.studentId}
            onChange={(e) => {
              const id = e.target.value;
              const picked = students.find((s) => s.id === id);
              setForm((f) => ({
                ...f,
                studentId: id,
                studentName: picked?.name ?? f.studentName,
                // 仅当用户没手填过班级时, 自动带入
                className: f.className?.trim() ? f.className : picked?.className ?? '',
              }));
            }}
          >
            <option value="">请选择学员</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.className ? `（${s.className}）` : ''} · {s.id}
              </option>
            ))}
            {students.length === 0 && (
              <option value="" disabled>
                暂无在读学员，请先到「学员管理」添加
              </option>
            )}
          </select>
          {!initial && students.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              学员列表为空。请到侧边栏「学员管理 → 新增学员」创建学员后再来提交作品。
            </p>
          )}
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
            对应课堂记录 ID
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.classLogId}
            onChange={(e) => setField('classLogId', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            分类
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
          >
            <option value="">请选择</option>
            <option value="作品">作品</option>
            <option value="项目">项目</option>
            <option value="代码">代码</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            排序号
          </label>
          <input
            type="number"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={form.sortOrder}
            onChange={(e) => setField('sortOrder', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            封面图 URL
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="https://..."
            value={form.coverImage}
            onChange={(e) => setField('coverImage', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            作品外链
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="https://..."
            value={form.linkUrl}
            onChange={(e) => setField('linkUrl', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            作品介绍
          </label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={4}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            技术栈（逗号分隔）
          </label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="React, TypeScript, Tailwind"
            value={form.techStackText}
            onChange={(e) => setField('techStackText', e.target.value)}
          />
        </div>

        {/* ===== 老师点评 ===== */}
        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            老师点评
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            家长分享打开作品详情页后能看到这段点评，写给孩子和家长的暖心话。
          </p>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            placeholder="例：炳炳对游戏规则有天然的敏感，最打动我的是他不怕改……"
            value={form.teacherComment}
            onChange={(e) => setField('teacherComment', e.target.value)}
          />
        </div>

        {/* ===== 能力评估 ===== */}
        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            能力评估（雷达图）
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            五项能力各打 0–10 分，留空则不展示能力评估区块。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                评估标题
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="例：炳炳学到了什么"
                value={form.ability.heading}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ability: { ...f.ability, heading: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                评估引言
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="例：不只是做完了游戏，更在过程中长出了这些能力。"
                value={form.ability.intro}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ability: { ...f.ability, intro: e.target.value },
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {ABILITY_LABELS.map((label, i) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="w-full border rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.ability.scores[i] ?? 7}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                    setForm((f) => {
                      const scores = [...f.ability.scores];
                      scores[i] = v;
                      return { ...f, ability: { ...f.ability, scores } };
                    });
                  }}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              评估备注
            </label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="例：* 评估基于 2 次课的过程记录，非标准化测试。"
              value={form.ability.note}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ability: { ...f.ability, note: e.target.value },
                }))
              }
            />
          </div>
        </div>

        {/* ===== 创作记录 ===== */}
        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-gray-900">
              创作记录
            </h3>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  processLog: [
                    ...f.processLog,
                    { time: '', tag: '', image: '', title: '', description: '' },
                  ],
                }))
              }
              className="px-3 py-1 text-sm rounded-md bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
            >
              ＋ 加一条
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            记录孩子从想法到完成的过程，每一条是一个时间点。图片留空则默认用作品封面。
          </p>
          <div className="space-y-3">
            {form.processLog.map((entry, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="阶段（例：第一阶段）"
                    value={entry.time}
                    onChange={(e) => updateProcessLog(i, 'time', e.target.value)}
                  />
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="标签（例：想法定义）"
                    value={entry.tag}
                    onChange={(e) => updateProcessLog(i, 'tag', e.target.value)}
                  />
                </div>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="标题（例：从动物大乱斗到迷宫）"
                  value={entry.title}
                  onChange={(e) => updateProcessLog(i, 'title', e.target.value)}
                />
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={2}
                  placeholder="描述"
                  value={entry.description}
                  onChange={(e) => updateProcessLog(i, 'description', e.target.value)}
                />
                {entry.image ? (
                  <div className="mb-2">
                    <img
                      src={entry.image}
                      alt="预览"
                      className="h-24 rounded border object-cover bg-gray-100"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploadingImageIdx === i || !initial?.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadProcessImage(i, f);
                      e.currentTarget.value = '';
                    }}
                    className="text-sm"
                  />
                  {uploadingImageIdx === i && (
                    <span className="text-xs text-gray-500">上传中…</span>
                  )}
                  {!initial?.id && (
                    <span className="text-xs text-amber-600">
                      保存作品后即可上传图片
                    </span>
                  )}
                </div>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="或填图片 URL（留空用封面）"
                  value={entry.image}
                  onChange={(e) => updateProcessLog(i, 'image', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      processLog: f.processLog.filter((_, idx) => idx !== i),
                    }))
                  }
                  className="px-3 py-1 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                >
                  删除这条
                </button>
              </div>
            ))}
            {form.processLog.length === 0 && (
              <p className="text-sm text-gray-400 py-2">
                暂无创作记录，点右上角「＋ 加一条」添加。
              </p>
            )}
          </div>
        </div>

        {/* ===== 作品介绍视频 ===== */}
        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            作品介绍视频
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            老师可上传本地视频（≤200MB，mp4/webm/mov），或填一个视频直链。
          </p>
          {(form.introVideoFile || form.introVideoUrl) && (
            <div className="mb-3">
              <video
                src={form.introVideoFile || form.introVideoUrl}
                controls
                className="w-full max-h-64 rounded-md bg-black"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              disabled={uploading || !initial?.id}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadVideo(f);
                e.currentTarget.value = '';
              }}
              className="text-sm"
            />
            {uploading && (
              <span className="text-xs text-gray-500">上传中…</span>
            )}
            {!initial?.id && (
              <span className="text-xs text-amber-600">
                保存作品后即可上传视频
              </span>
            )}
          </div>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="或填视频直链 https://..."
            value={form.introVideoUrl}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                introVideoUrl: e.target.value,
                introVideoFile: e.target.value ? '' : f.introVideoFile,
              }))
            }
          />
          {(form.introVideoFile || form.introVideoUrl) && (
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, introVideoFile: '', introVideoUrl: '' }))
              }
              className="mt-2 px-3 py-1 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
            >
              清除视频
            </button>
          )}
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="featured-check"
            checked={form.featured}
            onChange={(e) => setField('featured', e.target.checked)}
            className="w-4 h-4"
          />
          <label
            htmlFor="featured-check"
            className="text-sm text-gray-700 cursor-pointer"
          >
            设为精选作品
          </label>
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
            if (!form.title.trim()) {
              alert('请输入标题');
              return;
            }
            if (!form.studentId.trim()) {
              alert('请选择学员');
              return;
            }
            onSubmit(form);
          }}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          {initial ? '保存修改' : '创建作品'}
        </button>
      </div>
    </Overlay>
  );
}
