"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, X, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { processImageFile } from "@/lib/image-utils";
import { ProgressFeedback, ProgressStatus } from "@/components/ui/progress-feedback";
import { useLanguage } from "@/contexts/LanguageContext";
import { frontendLogger } from "@/lib/frontend-logger";

/** 一页的识别结果（与后端 PaperScanResult 同构，只保留前端用得到的部分） */
type PaperItem = {
    no: string;
    section: string;
    questionText: string;
    options: string[];
    studentAnswer: string;
    verdict: "wrong" | "blank";
    evidence: "teacher" | "blank" | "model";
    errorTag: string;
    knowledgePoints: string[];
    pageNo: number;
};

type PageResult = {
    title?: string;
    subject?: string;
    gradeSemester?: string;
    paperLevel?: string;
    pageNo: number;
    items: PaperItem[];
    stats: { total: number; wrong: number; blank: number; skipped: number };
    empty?: boolean;
};

type Pick = PaperItem & { key: string; checked: boolean };

const MAX_PAGES = 6;

/**
 * 拍整张卷子收错题（批次 WNPAPER）
 * ============================================================
 * 用户诉求（原话）：「错题本这里应该增加一个拍卷子功能，自动将卷子中的错题和空白题都归入
 * 错题本，但是错题和空白题目不直接批改答案，避免学生利用这个功能抄作业」。
 *
 * ★★★ 这一页从头到尾**不显示任何答案**，也不该显示：
 *   学生拿它来抄作业的成本必须比自己做题高。所以校对的粒度是"哪几道题要收"，
 *   不是"这道题该怎么做"。入库后详情页同样不给答案（见 error-items/[id]）。
 *
 * ★ 为什么一页一次请求：6 张图 + 长提示词一次发出去，上游又慢又容易被截断；
 *   分页请求还能让用户在"第 2 页"就看到前面已经找到几道题。
 *
 * ★ 为什么先识别、再统一入库：识别失败/拍糊的页要能当场重拍；
 *   而"入库"是一次事务（卷子 + 页图 + N 条错题），不能一半在库里一半在内存里。
 */
export default function PaperScanPage() {
    const params = useParams();
    const router = useRouter();
    const notebookId = params.id as string;
    const { t, language } = useLanguage();

    const [files, setFiles] = useState<{ key: string; file: File; url: string }[]>([]);
    const [phase, setPhase] = useState<"pick" | "scanning" | "review" | "saving">("pick");
    const [picks, setPicks] = useState<Pick[]>([]);
    const [pageResults, setPageResults] = useState<PageResult[]>([]);
    const [progress, setProgress] = useState(0);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [msg, setMsg] = useState("");
    const [aiTimeout, setAiTimeout] = useState(300000);
    const startRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        apiClient.get<{ timeouts?: { analyze?: number } }>("/api/settings")
            .then((d) => { if (d?.timeouts?.analyze) setAiTimeout(Number(d.timeouts.analyze) || 300000); })
            .catch(() => { });
    }, []);

    // 按真实秒数推进（与单题链路同一套口径：进度是模拟的，秒数是真的）
    useEffect(() => {
        let iv: NodeJS.Timeout | undefined;
        if (phase === "scanning" || phase === "saving") {
            const startedAt = startRef.current || Date.now();
            iv = setInterval(() => {
                const sec = (Date.now() - startedAt) / 1000;
                setElapsedSec(Math.floor(sec));
                setProgress((p) => Math.min(97, p + Math.max(0.2, (97 - p) * 0.02)));
            }, 500);
        }
        return () => { if (iv) clearInterval(iv); };
    }, [phase]);

    const addFiles = (fl: FileList | null) => {
        if (!fl) return;
        const next: { key: string; file: File; url: string }[] = [];
        for (const f of Array.from(fl)) {
            if (!f.type.startsWith("image/")) continue;
            next.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file: f, url: URL.createObjectURL(f) });
        }
        setFiles((prev) => [...prev, ...next].slice(0, MAX_PAGES));
    };

    const removeFile = (key: string) => {
        setFiles((prev) => {
            const hit = prev.find((f) => f.key === key);
            if (hit) URL.revokeObjectURL(hit.url);
            return prev.filter((f) => f.key !== key);
        });
    };

    const startScan = async () => {
        if (files.length === 0) return;
        startRef.current = Date.now();
        setPhase("scanning");
        setProgress(2);
        setElapsedSec(0);
        setPicks([]);
        setPageResults([]);

        const collected: Pick[] = [];
        const results: PageResult[] = [];

        for (let i = 0; i < files.length; i++) {
            const base = Math.round((i / files.length) * 90);
            setProgress(Math.max(2, base));
            setMsg(
                (t.paper?.scanningPage || "正在识别第 {n}/{m} 页…")
                    .replace("{n}", String(i + 1))
                    .replace("{m}", String(files.length))
            );
            try {
                const base64 = await processImageFile(files[i].file);
                // 记下压缩后的图，入库时直接复用（不再重新压一次）
                (files[i] as any)._base64 = base64;

                const res = await apiClient.post<PageResult>("/api/analyze-paper", {
                    imageBase64: base64,
                    language,
                    subjectId: notebookId,
                    pageNo: i + 1,
                }, { timeout: aiTimeout });

                results.push(res);
                for (const it of res.items || []) {
                    collected.push({ ...it, key: `${it.pageNo}-${it.section}-${it.no}-${collected.length}`, checked: true });
                }
                frontendLogger.info("[PaperScan]", "page analyzed", {
                    pageNo: i + 1, items: (res.items || []).length, empty: !!res.empty,
                });
            } catch (e: any) {
                frontendLogger.error("[PaperScan]", "page failed", { pageNo: i + 1, error: e?.message || String(e) });
                setMsg(
                    (t.paper?.pageFailed || "第 {n} 页没识别成功，可以先跳过它").replace("{n}", String(i + 1))
                );
                results.push({ pageNo: i + 1, items: [], stats: { total: 0, wrong: 0, blank: 0, skipped: 0 }, empty: true });
            }
        }

        setPageResults(results);
        setPicks(collected);
        setProgress(100);
        setPhase("review");
        setMsg("");
        if (collected.length === 0) {
            setMsg(t.paper?.noItemFound || "这一遍没找到错题或空白题。如果卷子上确实有，试试光线亮一点、把整页拍全。");
        }
    };

    const toggle = (key: string) => {
        setPicks((prev) => prev.map((p) => (p.key === key ? { ...p, checked: !p.checked } : p)));
    };

    const editQuestion = (key: string, text: string) => {
        setPicks((prev) => prev.map((p) => (p.key === key ? { ...p, questionText: text } : p)));
    };

    const save = async () => {
        const chosen = picks.filter((p) => p.checked && p.questionText.trim());
        if (chosen.length === 0) return;

        startRef.current = Date.now();
        setPhase("saving");
        setProgress(20);
        setMsg(t.paper?.saving || "正在存进错题本…");

        try {
            const pages = files.map((f, i) => ({
                pageNo: i + 1,
                imageBase64: (f as any)._base64 || "",
            })).filter((p) => p.imageBase64);

            const head = pageResults.find((r) => r.title) || pageResults[0] || ({} as PageResult);

            const res = await apiClient.post<{ scanId: string; created: number; duplicates?: number; invalid?: number }>(
                "/api/paper-scans",
                {
                    subjectId: notebookId,
                    title: head.title || "",
                    gradeSemester: head.gradeSemester || "",
                    paperLevel: head.paperLevel || "",
                    pages,
                    items: chosen.map((p) => ({
                        no: p.no,
                        section: p.section,
                        questionText: p.questionText.trim(),
                        options: p.options,
                        studentAnswer: p.studentAnswer,
                        verdict: p.verdict,
                        evidence: p.evidence,
                        errorTag: p.errorTag,
                        knowledgePoints: p.knowledgePoints,
                        pageNo: p.pageNo,
                    })),
                },
                { timeout: 120000 }
            );

            const tail = res.duplicates && res.duplicates > 0
                ? (t.paper?.savedWithDup || "，另有 {n} 道题之前已经收过，自动跳过了").replace("{n}", String(res.duplicates))
                : "";
            alert((t.paper?.saved || "已收进错题本：{n} 道题").replace("{n}", String(res.created)) + tail);
            router.push(`/notebooks/${notebookId}`);
        } catch (e: any) {
            frontendLogger.error("[PaperScan]", "save failed", { error: e?.message || String(e) });
            alert(t.paper?.saveFailed || "保存失败，请再试一次（已识别的内容还在这一页）");
            setPhase("review");
        } finally {
            setMsg("");
        }
    };

    const checkedCount = picks.filter((p) => p.checked).length;
    const totalFound = picks.length;

    return (
        <main className="min-h-screen bg-background pb-28">
            <ProgressFeedback status={phase === "scanning" ? "analyzing" : phase === "saving" ? "saving" : "idle"} progress={progress} message={msg} elapsedSec={elapsedSec} />

            <div className="container mx-auto max-w-3xl p-4 space-y-5">
                <div className="flex items-center gap-3">
                    <Link href={`/notebooks/${notebookId}`}>
                        <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
                    </Link>
                    <h1 className="text-xl font-bold">{t.paper?.title || "拍整张卷子"}</h1>
                </div>

                {/* ★ 把"不给答案"明说。学生知道这一点才不会有"怎么没有答案"的预期落差，
                    家长/老师也知道这条链路的定位是收题，不是讲题。 */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                    <b>{t.paper?.noticeBold || "这个入口只收题，不给答案。"}</b>
                    {t.paper?.notice ||
                        "拍完整张卷子，自动把「做错的」和「空着的」挑出来存进错题本。答案和解析不会显示——错题要自己再做一遍才有用。"}
                </div>

                {phase === "pick" && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
                        />
                        <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                {(t.paper?.pickHint || "一页拍一张，最多 {n} 页。卷子拍不全就分两张拍。").replace("{n}", String(MAX_PAGES))}
                            </p>
                            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                                <Camera className="h-4 w-4" />
                                {t.paper?.pick || "拍照 / 从相册选"}
                            </Button>
                        </div>

                        {files.length > 0 && (
                            <div className="grid grid-cols-3 gap-3">
                                {files.map((f, i) => (
                                    <div key={f.key} className="relative">
                                        <img src={f.url} alt={`page ${i + 1}`} className="h-28 w-full rounded-lg border object-cover" />
                                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(f.key)}
                                            className="absolute -right-1.5 -top-1.5 rounded-full border bg-white p-1 text-muted-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Button className="w-full" disabled={files.length === 0} onClick={startScan}>
                            {t.paper?.start || "开始识别"}（{files.length} 页）
                        </Button>
                    </>
                )}

                {phase === "review" && (
                    <>
                        {msg && (
                            <div className="rounded-lg border p-3 text-sm text-muted-foreground">{msg}</div>
                        )}

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                {(t.paper?.found || "找到 {n} 道要收的题").replace("{n}", String(totalFound))}
                                {pageResults.some((r) => r.empty) && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {(t.paper?.somePageEmpty || "有 {n} 页没认出题").replace("{n}", String(pageResults.filter((r) => r.empty).length))}
                                    </span>
                                )}
                            </span>
                            <button
                                type="button"
                                className="text-primary"
                                onClick={() => {
                                    const all = checkedCount !== totalFound;
                                    setPicks((prev) => prev.map((p) => ({ ...p, checked: all })));
                                }}
                            >
                                {checkedCount === totalFound ? (t.paper?.uncheckAll || "全不选") : (t.paper?.checkAll || "全选")}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {picks.map((p) => (
                                <div key={p.key} className={`rounded-lg border p-3 space-y-2 ${p.checked ? "" : "opacity-55"}`}>
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={p.checked}
                                            onChange={() => toggle(p.key)}
                                            className="mt-1 h-5 w-5 shrink-0"
                                        />
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                <span className="font-semibold text-sm">
                                                    {(p.section ? p.section + " " : "") + (t.paper?.questionNo || "第 {no} 题").replace("{no}", p.no)}
                                                </span>
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                                                    {(t.paper?.page || "第 {n} 页").replace("{n}", String(p.pageNo))}
                                                </span>
                                                {p.verdict === "blank" ? (
                                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">{t.paper?.badgeBlank || "空白题"}</span>
                                                ) : p.evidence === "teacher" ? (
                                                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">{t.paper?.badgeTeacher || "老师批错"}</span>
                                                ) : (
                                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{t.paper?.badgeModel || "AI 判断，可能有误"}</span>
                                                )}
                                                {p.errorTag && (
                                                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{p.errorTag}</span>
                                                )}
                                            </div>

                                            <textarea
                                                value={p.questionText}
                                                onChange={(e) => editQuestion(p.key, e.target.value)}
                                                rows={Math.min(6, Math.max(2, Math.ceil(p.questionText.length / 38)))}
                                                className="w-full resize-y rounded border bg-background p-2 text-sm leading-6"
                                            />
                                            {p.options.length > 0 && (
                                                <div className="text-xs text-muted-foreground">
                                                    {p.options.map((o, i) => <span key={i} className="mr-3">{String.fromCharCode(65 + i)}. {o}</span>)}
                                                </div>
                                            )}
                                            <div className="text-xs text-muted-foreground">
                                                {t.paper?.studentAnswer || "学生写的"}：{p.studentAnswer ? <span className="font-medium text-foreground">{p.studentAnswer}</span> : <i>{t.paper?.blankAnswer || "（没写）"}</i>}
                                            </div>
                                            {p.knowledgePoints.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {p.knowledgePoints.map((k, i) => (
                                                        <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{k}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {totalFound === 0 && (
                            <Button variant="outline" className="w-full" onClick={() => { setPhase("pick"); setFiles([]); }}>
                                {t.paper?.retry || "重新拍"}
                            </Button>
                        )}
                    </>
                )}
            </div>

            {phase === "review" && totalFound > 0 && (
                <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
                    <div className="container mx-auto flex max-w-3xl items-center gap-3">
                        <div className="text-sm text-muted-foreground">
                            {(t.paper?.checkedCount || "已选 {n} 道").replace("{n}", String(checkedCount))}
                        </div>
                        <Button className="ml-auto gap-2" disabled={checkedCount === 0} onClick={save}>
                            <CheckCircle2 className="h-4 w-4" />
                            {t.paper?.saveButton || "收进错题本"}
                        </Button>
                    </div>
                </div>
            )}
        </main>
    );
}
