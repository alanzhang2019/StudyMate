"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Trash2, Edit, Save, X, Box, Loader2, Eye, EyeOff, ImageIcon, MessageCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TagInput } from "@/components/tag-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { UserProfile, Notebook } from "@/types/api";
import { inferSubjectFromName } from "@/lib/knowledge-tags";
import { getMistakeStatusLabel, normalizeMistakeStatusForSave } from "@/lib/mistake-status";
import { NotebookSelector } from "@/components/notebook-selector";
import { GeogebraDemo } from "@/components/geogebra-demo";
import { VideoExplain } from "@/components/video-explain";
import { TutorChat } from "@/components/tutor-chat";

interface KnowledgeTag {
    id: string;
    name: string;
}

interface ErrorItemDetail {
    id: string;
    questionText: string;
    answerText: string;
    analysis: string;
    wrongAnswerText?: string | null;
    mistakeAnalysis?: string | null;
    mistakeStatus?: string | null;
    knowledgePoints: string; // 保留兼容旧数据
    tags: KnowledgeTag[]; // 新的标签关联
    masteryLevel: number;
    originalImageUrl: string;
    referenceImageUrl?: string | null;
    wrongAnswerImageUrl?: string | null;
    userNotes: string | null;
    subjectId?: string | null;
    subject?: {
        id: string;
        name: string;
    } | null;
    gradeSemester?: string | null;
    paperLevel?: string | null;
    // ★ 批次 WNPAPER：拍照收卷进来的题，answerText/analysis 一定是空的（产品上就不给答案）。
    //   paperScanId/paperPageNo 用来回看原卷那一页。
    paperScanId?: string | null;
    paperPageNo?: number | null;
    source?: string | null;
    geogebraCommands?: string | null;
}

export default function ErrorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { t, language } = useLanguage();
    const [item, setItem] = useState<ErrorItemDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesInput, setNotesInput] = useState("");
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    // 小老师抽屉（2026-10-22）：open 状态放在页面这一层，因为入口在头部按钮、
    // 抽屉在页面末尾 —— 两边都要能改它。useCallback 是为了让 TutorChat 里那个
    // postMessage 监听的 effect 不因每次渲染重订阅。
    const [tutorOpen, setTutorOpen] = useState(false);
    const openTutor = useCallback(() => setTutorOpen(true), []);
    const closeTutor = useCallback(() => setTutorOpen(false), []);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [tagsInput, setTagsInput] = useState<string[]>([]);
    const [isEditingMetadata, setIsEditingMetadata] = useState(false);
    const [gradeSemesterInput, setGradeSemesterInput] = useState("");
    const [paperLevelInput, setPaperLevelInput] = useState("a");
    const [notebookInput, setNotebookInput] = useState<string | null>(null);

    const [educationStage, setEducationStage] = useState<string | undefined>(undefined);

    const [isAnalyzingGeogebra, setIsAnalyzingGeogebra] = useState(false);
    const [geogebraError, setGeogebraError] = useState<string | null>(null);
    const [showQuestionImage, setShowQuestionImage] = useState(false);
    const [showReferenceImage, setShowReferenceImage] = useState(false);
    const [showOwnImage, setShowOwnImage] = useState(false);
    // ★ 批次 WNPAPER：拍照收卷进来的题没有答案，但可以回看「原卷那一页」。
    //   页图存在 PaperPage 里（一页一份），这里按 paperScanId 按需拉取。
    const [paperPages, setPaperPages] = useState<{ pageNo: number; imageUrl: string }[] | null>(null);
    const [showPaperPage, setShowPaperPage] = useState(false);
    const [paperPageLoading, setPaperPageLoading] = useState(false);

    /** 打开/收起「原卷那一页」。第一次点击才去拉页图（base64 不小，别在列表入口就预加载）。 */
    const togglePaperPage = async () => {
        if (!item?.paperScanId) return;
        const next = !showPaperPage;
        setShowPaperPage(next);
        if (!next || paperPages || paperPageLoading) return;
        setPaperPageLoading(true);
        try {
            const scan = await apiClient.get<{ pages: { pageNo: number; imageUrl: string }[] }>(`/api/paper-scans/${item.paperScanId}`);
            setPaperPages(scan?.pages || []);
        } catch (e) {
            console.error('Failed to load paper page', e);
            setPaperPages([]);
        } finally {
            setPaperPageLoading(false);
        }
    };
    const [showFloatingQuestion, setShowFloatingQuestion] = useState(false);
    const questionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch user info for education stage
        apiClient.get<UserProfile>("/api/user")
            .then(user => {
                if (user && user.educationStage) {
                    setEducationStage(user.educationStage);
                }
            })
            .catch(err => console.error("Failed to fetch user info:", err));

        if (params.id) {
            fetchItem(params.id as string);
        }
    }, [params.id]);

    const fetchItem = async (id: string) => {
        try {
            const data = await apiClient.get<ErrorItemDetail>(`/api/error-items/${id}`);
            setItem(data);
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.loadFailed || 'Failed to load item');
            router.push("/notebooks");
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeGeogebra = async () => {
        if (!item) return;
        setIsAnalyzingGeogebra(true);
        setGeogebraError(null);
        try {
            const result = await apiClient.post<{
                suitable: boolean;
                commands: string[];
                description: string;
            }>(`/api/error-items/${item.id}/geogebra`, {});

            if (result.suitable && result.commands.length > 0) {
                setItem({ ...item, geogebraCommands: JSON.stringify(result.commands) });
            } else {
                setGeogebraError(result.description || "该题目不适合用 GeoGebra 演示");
            }
        } catch (error: any) {
            console.error("GeoGebra analysis failed:", error);
            const msg = error?.data?.message || error?.message || "";
            if (msg.includes("AI_AUTH_ERROR")) {
                setGeogebraError("AI 认证失败，请检查设置");
            } else if (msg.includes("AI_CONNECTION")) {
                setGeogebraError("AI 连接失败，请检查网络");
            } else {
                setGeogebraError("分析失败，请稍后重试");
            }
        } finally {
            setIsAnalyzingGeogebra(false);
        }
    };

    const handleSaveGeogebraCommands = async (commands: string) => {
        if (!item) return;
        await apiClient.put(`/api/error-items/${item.id}`, { geogebraCommands: commands });
        setItem({ ...item, geogebraCommands: commands });
    };

    const toggleMastery = async () => {
        if (!item) return;

        const newLevel = item.masteryLevel > 0 ? 0 : 1;

        try {
            await apiClient.patch(`/api/error-items/${item.id}/mastery`, { masteryLevel: newLevel });
            setItem({ ...item, masteryLevel: newLevel });
            alert(newLevel > 0 ? (t.common?.messages?.markMastered || 'Marked as mastered') : (t.common?.messages?.unmarkMastered || 'Unmarked'));
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.updateFailed || 'Update failed');
        }
    };

    const deleteItem = async () => {
        if (!item) return;

        const confirmMessage = t.common?.messages?.confirmDelete || 'Are you sure you want to delete this error item?';
        if (!confirm(confirmMessage)) return;

        try {
            await apiClient.delete(`/api/error-items/${item.id}/delete`);
            alert(t.common?.messages?.deleteSuccess || 'Deleted successfully');
            if (item.subjectId) {
                router.push(`/notebooks/${item.subjectId}`);
            } else {
                router.push('/notebooks');
            }
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.deleteFailed || 'Delete failed');
        }
    };

    const startEditingNotes = () => {
        setNotesInput(item?.userNotes || "");
        setIsEditingNotes(true);
    };

    const cancelEditingNotes = () => {
        setIsEditingNotes(false);
        setNotesInput("");
    };

    const startEditingTags = () => {
        if (item) {
            // 优先使用新的 tags 关联
            if (item.tags && item.tags.length > 0) {
                setTagsInput(item.tags.map(t => t.name));
            } else if (item.knowledgePoints) {
                // 回退到旧的 knowledgePoints 字段
                try {
                    const tags = JSON.parse(item.knowledgePoints);
                    setTagsInput(tags);
                } catch (e) {
                    setTagsInput([]);
                }
            } else {
                setTagsInput([]);
            }
            setIsEditingTags(true);
        }
    };

    const saveTagsHandler = async () => {
        try {
            // 直接传递标签名称数组，后端会处理关联
            await apiClient.put(`/api/error-items/${item?.id}`, {
                knowledgePoints: tagsInput, // 后端接收数组
            });

            setIsEditingTags(false);
            await fetchItem(params.id as string);
            alert(t.common?.messages?.tagUpdateSuccess || 'Tags updated successfully!');
        } catch (error) {
            console.error("[Frontend] Error updating:", error);
            alert(t.common?.messages?.updateFailed || 'Update failed');
        }
    };

    const cancelEditingTags = () => {
        setIsEditingTags(false);
        setTagsInput([]);
    };

    const startEditingMetadata = () => {
        if (item) {
            setNotebookInput(item.subjectId || null);
            setGradeSemesterInput(item.gradeSemester || "");
            setPaperLevelInput(item.paperLevel || "a");
            setIsEditingMetadata(true);
        }
    };

    const saveMetadataHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, {
                subjectId: notebookInput || null,
                gradeSemester: gradeSemesterInput,
                paperLevel: paperLevelInput,
            });

            setIsEditingMetadata(false);
            fetchItem(params.id as string);
            alert(t.common?.messages?.metaUpdateSuccess || 'Metadata updated successfully!');
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.updateFailed || 'Update failed');
        }
    };

    const cancelEditingMetadata = () => {
        setIsEditingMetadata(false);
        setNotebookInput(null);
        setGradeSemesterInput("");
        setPaperLevelInput("a");
    };

    const [isEditingQuestion, setIsEditingQuestion] = useState(false);
    const [questionInput, setQuestionInput] = useState("");

    const [isEditingAnswer, setIsEditingAnswer] = useState(false);
    const [answerInput, setAnswerInput] = useState("");

    const [isEditingAnalysis, setIsEditingAnalysis] = useState(false);
    const [analysisInput, setAnalysisInput] = useState("");

    const [isEditingMistake, setIsEditingMistake] = useState(false);
    const [wrongAnswerInput, setWrongAnswerInput] = useState("");
    const [mistakeAnalysisInput, setMistakeAnalysisInput] = useState("");
    const [mistakeStatusInput, setMistakeStatusInput] = useState("unknown");

    // --- Question Handlers ---
    const startEditingQuestion = () => {
        if (item) {
            setQuestionInput(item.questionText);
            setIsEditingQuestion(true);
        }
    };

    const saveQuestionHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, { questionText: questionInput });
            setIsEditingQuestion(false);
            if (item) setItem({ ...item, questionText: questionInput });
            alert(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingQuestion = () => {
        setIsEditingQuestion(false);
        setQuestionInput("");
    };

    // --- Answer Handlers ---
    const startEditingAnswer = () => {
        if (item) {
            setAnswerInput(item.answerText);
            setIsEditingAnswer(true);
        }
    };

    const saveAnswerHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, { answerText: answerInput });
            setIsEditingAnswer(false);
            if (item) setItem({ ...item, answerText: answerInput });
            alert(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingAnswer = () => {
        setIsEditingAnswer(false);
        setAnswerInput("");
    };

    // --- Analysis Handlers ---
    const startEditingAnalysis = () => {
        if (item) {
            setAnalysisInput(item.analysis);
            setIsEditingAnalysis(true);
        }
    };

    const saveAnalysisHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, { analysis: analysisInput });
            setIsEditingAnalysis(false);
            if (item) setItem({ ...item, analysis: analysisInput });
            alert(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingAnalysis = () => {
        setIsEditingAnalysis(false);
        setAnalysisInput("");
    };

    // --- Mistake Analysis Handlers ---
    const startEditingMistake = () => {
        if (item) {
            setWrongAnswerInput(item.wrongAnswerText || "");
            setMistakeAnalysisInput(item.mistakeAnalysis || "");
            setMistakeStatusInput(item.mistakeStatus || "unknown");
            setIsEditingMistake(true);
        }
    };

    const saveMistakeHandler = async () => {
        try {
            const normalizedStatus = normalizeMistakeStatusForSave(
                mistakeStatusInput,
                wrongAnswerInput
            );
            await apiClient.put(`/api/error-items/${item?.id}`, {
                wrongAnswerText: wrongAnswerInput,
                mistakeAnalysis: mistakeAnalysisInput,
                mistakeStatus: normalizedStatus,
            });
            setIsEditingMistake(false);
            if (item) {
                setItem({
                    ...item,
                    wrongAnswerText: wrongAnswerInput,
                    mistakeAnalysis: mistakeAnalysisInput,
                    mistakeStatus: normalizedStatus,
                });
            }
            alert(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingMistake = () => {
        setIsEditingMistake(false);
        setWrongAnswerInput("");
        setMistakeAnalysisInput("");
        setMistakeStatusInput("unknown");
    };

    const saveNotes = async () => {
        if (!item) return;

        try {
            await apiClient.patch(`/api/error-items/${item.id}/notes`, { userNotes: notesInput });
            setItem({ ...item, userNotes: notesInput });
            setIsEditingNotes(false);
            alert(t.common?.messages?.noteSaveSuccess || 'Notes saved successfully');
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            if (!questionRef.current) return;
            const rect = questionRef.current.getBoundingClientRect();
            if (rect.bottom < -50) {
                setShowFloatingQuestion(true);
            } else {
                setShowFloatingQuestion(false);
            }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (loading) return <div className="p-8 text-center">{t.common.loading}</div>;
    if (!item) return <div className="p-8 text-center">{t.detail.notFound || "Item not found"}</div>;

    // 优先从 tags 关联获取，回退到 knowledgePoints
    let tags: string[] = [];
    if (item.tags && item.tags.length > 0) {
        tags = item.tags.map(t => t.name);
    } else if (item.knowledgePoints) {
        try {
            const parsed = JSON.parse(item.knowledgePoints);
            tags = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            tags = [];
        }
    }

    /**
     * ★★★ 拍照收卷的题**没有答案**，这是产品红线（防抄作业），不是"还没算出来"。
     *   所以不能让它渲染成一片空白 —— 学生会以为页面坏了，甚至跑去点"编辑"自己填。
     *   这里明说：答案不会来，要就自己做一遍。
     */
    const paperLockedNotice = (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            <b className="text-foreground">{t.paper?.lockedTitle || "这道题是拍照收卷收进来的，没有附带答案。"}</b>
            <br />
            {t.paper?.lockedHint || "想对答案就自己做一遍再看错在哪 —— 抄一遍错题，下次还是会错。"}
        </div>
    );

    /**
     * ★★★ 光把「答案卡 / 解析卡」按住是不够的（批次 WNPAPER）。
     *   详情页还有三条路能把答案送到学生手里：
     *     ① 问小老师（TutorChat，且能被父页面 postMessage 唤起）
     *     ② 视频讲解（VideoExplain 截图直读直解）
     *     ③ GeoGebra 一键生成演示（也是先解题再画图）
     *   三条都是"解题器"，留着等于把刚堵的口子从侧面又开一遍。
     *   ⇒ 拍照收卷的题**整块不挂载**，改给一句说明 + 指向「练习」。
     *   注意是"不挂载"而不是"藏起来"：TutorChat 里那个 message 监听一旦挂上，
     *   hl-platform 工具栏发 `wn:tutor-open` 就能把抽屉弹开。
     */
    const fromPaperScan = !!item.paperScanId;
    const solverLockedNotice = (
        <div className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
            <b className="text-foreground">{t.paper?.solverLockedTitle || "这道题不给讲解。"}</b>
            <br />
            {t.paper?.solverLockedHint || "它是从卷子上收进来的，讲解里会带着答案。先自己做一遍（点上面的「练习」），做完再回来看。"}
        </div>
    );

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto p-4 space-y-6 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Link href={item.subjectId ? `/notebooks/${item.subjectId}` : "/notebooks"}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold">{t.detail.title}</h1>
                    </div>

                    <div className="flex gap-2">
                        {/* 小老师入口（2026-10-22 用户拍板：「入口可以在错题本右上角那里加上」）。
                            ★ 抽屉本体在页面末尾的 <TutorChat> 里；这里只负责把 open 置真。
                            ★ 与 hl-platform 错题本工具栏那个按钮是**同一件事的两个入口**：
                              在 iframe 里用这个，新窗口打开（独立访问）时也只有这个能用。 */}
                        {/* WNPAPER：拍照收卷的题不给解题器（见上方 fromPaperScan 注释）。 */}
                        {!fromPaperScan && (
                            <Button variant="outline" size="sm" onClick={openTutor}>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                问小老师
                            </Button>
                        )}
                        <Link href={`/practice?id=${item.id}`}>
                            <Button variant="outline" size="sm">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t.detail.practice}
                            </Button>
                        </Link>
                        <Button
                            size="sm"
                            variant={item.masteryLevel > 0 ? "default" : "default"}
                            className={item.masteryLevel > 0 ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                            onClick={toggleMastery}
                        >
                            {item.masteryLevel > 0 ? (
                                <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    {t.detail.mastered}
                                </>
                            ) : (
                                <>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    {t.detail.markMastered}
                                </>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={deleteItem}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t.detail.delete || "Delete"}
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail.question}</CardTitle>{!isEditingQuestion && <Button variant="ghost" size="sm" onClick={startEditingQuestion}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader>
                    <CardContent className="space-y-4">
                        {isEditingQuestion ? (
                            <div className="space-y-3">
                                <Textarea value={questionInput} onChange={e => setQuestionInput(e.target.value)} placeholder="Enter question text..." rows={8} className="w-full font-mono text-sm" />
                                <div className="flex gap-2"><Button size="sm" onClick={saveQuestionHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingQuestion}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div>
                            </div>
                        ) : <MarkdownRenderer content={item.questionText} />}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><h4 className="text-sm font-semibold">{t.editor?.tags || "Knowledge Tags"}</h4>{!isEditingTags && <Button variant="ghost" size="sm" onClick={startEditingTags}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div>
                            {isEditingTags ? (
                                <div className="space-y-3">
                                    <TagInput value={tagsInput} onChange={setTagsInput} placeholder={t.editor?.tagsPlaceholder || "Enter or select knowledge tags..."} subject={inferSubjectFromName(item.subject?.name || null) || undefined} gradeStage={educationStage} />
                                    <p className="text-xs text-muted-foreground">{t.editor?.tagsHint || "Select from standard or custom tags"}</p>
                                    <div className="flex gap-2"><Button size="sm" onClick={saveTagsHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingTags}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div>
                                </div>
                            ) : <div className="flex flex-wrap gap-2">{tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                            <div className="flex justify-between items-center"><h4 className="text-sm font-semibold">{t.detail?.questionInfo || "Question Info"}</h4>{!isEditingMetadata && <Button variant="ghost" size="sm" onClick={startEditingMetadata}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div>
                            {isEditingMetadata ? (
                                <div className="space-y-3">
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.notebooks?.title || "Notebook"}</label><NotebookSelector value={notebookInput || undefined} onChange={setNotebookInput} /></div>
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.filter.grade}</label><Input value={gradeSemesterInput} onChange={e => setGradeSemesterInput(e.target.value)} placeholder={t.notebook?.gradeSemesterPlaceholder || "e.g. Grade 7, Semester 1"} /></div>
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.filter.paperLevel}</label><Select value={paperLevelInput} onValueChange={setPaperLevelInput}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">{t.editor.paperLevels?.a || "Paper A"}</SelectItem><SelectItem value="b">{t.editor.paperLevels?.b || "Paper B"}</SelectItem><SelectItem value="other">{t.editor.paperLevels?.other || "Other"}</SelectItem></SelectContent></Select></div>
                                    <div className="flex gap-2"><Button size="sm" onClick={saveMetadataHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingMetadata}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div>
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t.notebooks?.title || "Notebook"}:</span><span className="font-medium">{item.subject?.name || (t.common?.notSet || "Not set")}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t.filter.grade}:</span><span className="font-medium">{item.gradeSemester || (t.common?.notSet || "Not set")}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t.filter.paperLevel}:</span><span className="font-medium">{item.paperLevel ? (t.editor.paperLevels?.[item.paperLevel as "a" | "b" | "other"] || item.paperLevel) : (t.common?.notSet || "Not set")}</span></div>
                                </div>
                            )}
                        </div>

                        {item.originalImageUrl && (
                            <div className="pt-3">
                                <Button variant="outline" size="sm" onClick={() => setShowQuestionImage(!showQuestionImage)} className="flex items-center gap-2">
                                    {showQuestionImage ? <><EyeOff className="h-4 w-4" />隐藏原题图片</> : <><ImageIcon className="h-4 w-4" />查看原题图片</>}
                                </Button>
                                {showQuestionImage && <div className="mt-4"><img src={item.originalImageUrl} alt={t.detail.originalProblem || "Original Problem"} className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setIsImageViewerOpen(true)} /><p className="text-xs text-muted-foreground mt-1 text-center">{t.detail?.clickToEnlarge || "Click to enlarge"}</p></div>}
                            </div>
                        )}

                        {/* ★ 拍照收卷的题没有单题图（不为每题存一份整页 base64），改成回看原卷那一页 */}
                        {item.paperScanId && (
                            <div className="pt-3">
                                <Button variant="outline" size="sm" onClick={togglePaperPage} className="flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" />
                                    {showPaperPage
                                        ? (t.paper?.hidePage || "收起原卷")
                                        : (t.paper?.viewPage || "查看原卷{page}").replace("{page}", item.paperPageNo ? `（第 ${item.paperPageNo} 页）` : "")}
                                </Button>
                                {showPaperPage && (
                                    <div className="mt-4">
                                        {paperPageLoading && <p className="text-sm text-muted-foreground">{t.common?.loading || "加载中…"}</p>}
                                        {!paperPageLoading && paperPages && paperPages.length > 0 && (() => {
                                            const page = paperPages.find(p => p.pageNo === (item.paperPageNo || 1)) || paperPages[0];
                                            return (
                                                <>
                                                    <img
                                                        src={page.imageUrl}
                                                        alt={`paper page ${page.pageNo}`}
                                                        className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => setIsImageViewerOpen(true)}
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1 text-center">
                                                        {(t.paper?.page || "第 {n} 页").replace("{n}", String(page.pageNo))}
                                                    </p>
                                                </>
                                            );
                                        })()}
                                        {!paperPageLoading && paperPages && paperPages.length === 0 && (
                                            <p className="text-sm text-muted-foreground">{t.paper?.pageMissing || "原卷页图已不在（可能被清理过）"}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 视频讲解（2026-10-24；2026-10-28 按用户要求挪到题目下方）：
                    截图直读直解 → videoclass 出片。入口常驻，已有任务自动恢复，
                    服务端幂等不重复出片。
                    WNPAPER：拍照收卷的题不挂载 —— 出片就是完整解题过程。 */}
                {fromPaperScan ? solverLockedNotice : <VideoExplain errorItemId={item.id} questionText={item.questionText} />}

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-primary/20">
                        <CardHeader><div className="flex justify-between items-center"><CardTitle className="text-primary">{t.detail.correctAnswer}</CardTitle>{!isEditingAnswer && <Button variant="ghost" size="sm" onClick={startEditingAnswer}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader>
                        <CardContent className="space-y-4">
                            {isEditingAnswer ? (
                                <div className="space-y-3"><Textarea value={answerInput} onChange={e => setAnswerInput(e.target.value)} placeholder="Enter answer..." rows={5} className="w-full font-mono text-sm" /><div className="flex gap-2"><Button size="sm" onClick={saveAnswerHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingAnswer}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div></div>
                            ) : (item.paperScanId && !item.answerText ? paperLockedNotice : <MarkdownRenderer content={item.answerText} className="font-semibold" />)}
                            {item.referenceImageUrl && <div className="pt-3"><Button variant="ghost" size="sm" onClick={() => setShowReferenceImage(!showReferenceImage)} className="flex items-center gap-2 text-muted-foreground">{showReferenceImage ? <><EyeOff className="h-4 w-4" />隐藏图片</> : <><ImageIcon className="h-4 w-4" />查看图片</>}</Button>{showReferenceImage && <div className="mt-4"><img src={item.referenceImageUrl} alt="参考图片" className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setIsImageViewerOpen(true)} /><p className="text-xs text-muted-foreground mt-1 text-center">{t.detail?.clickToEnlarge || "Click to enlarge"}</p></div>}</div>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><div className="flex justify-between items-center"><CardTitle>{t.editor?.wrongAnswerText || "我的答案"}</CardTitle>{!isEditingMistake && <Button variant="ghost" size="sm" onClick={startEditingMistake}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader>
                        <CardContent className="space-y-4">
                            {isEditingMistake ? (
                                <div className="space-y-4">
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.mistakeStatus || "作答状态"}</label><Select value={mistakeStatusInput} onValueChange={setMistakeStatusInput}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_attempted">{t.editor?.mistakeStatuses?.notAttempted || "不会做"}</SelectItem><SelectItem value="wrong_attempt">{t.editor?.mistakeStatuses?.wrongAttempt || "做错了"}</SelectItem><SelectItem value="unknown">{t.editor?.mistakeStatuses?.unknown || "未判断"}</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.wrongAnswerText || "错误解答原文"}</label><Textarea value={wrongAnswerInput} onChange={e => { setWrongAnswerInput(e.target.value); if (e.target.value.trim()) setMistakeStatusInput("wrong_attempt"); }} rows={5} className="w-full font-mono text-sm" /></div>
                                    <div className="flex gap-2"><Button size="sm" onClick={saveMistakeHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingMistake}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Badge variant={item.mistakeStatus === "wrong_attempt" ? "default" : "secondary"}>{getMistakeStatusLabel(item.mistakeStatus, language)}</Badge>
                                    {item.wrongAnswerText ? <MarkdownRenderer content={item.wrongAnswerText} /> : <p className="text-sm text-muted-foreground italic">{t.detail?.noMistakeAnalysis || "暂无错误解答"}</p>}
                                    {item.wrongAnswerImageUrl && <div className="pt-3"><Button variant="ghost" size="sm" onClick={() => setShowOwnImage(!showOwnImage)} className="flex items-center gap-2 text-muted-foreground">{showOwnImage ? <><EyeOff className="h-4 w-4" />隐藏图片</> : <><ImageIcon className="h-4 w-4" />查看图片</>}</Button>{showOwnImage && <div className="mt-4"><img src={item.wrongAnswerImageUrl} alt="我的答案图片" className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setIsImageViewerOpen(true)} /><p className="text-xs text-muted-foreground mt-1 text-center">{t.detail?.clickToEnlarge || "Click to enlarge"}</p></div>}</div>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail.analysis}</CardTitle>{!isEditingAnalysis && <Button variant="ghost" size="sm" onClick={startEditingAnalysis}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader><CardContent>{isEditingAnalysis ? (<div className="space-y-3"><Textarea value={analysisInput} onChange={e => setAnalysisInput(e.target.value)} placeholder="Enter analysis..." rows={12} className="w-full font-mono text-sm" /><div className="flex gap-2"><Button size="sm" onClick={saveAnalysisHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingAnalysis}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div></div>) : (item.paperScanId && !item.analysis ? paperLockedNotice : <MarkdownRenderer content={item.analysis} />)}</CardContent></Card>
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail?.mistakeAnalysis || "错因分析"}</CardTitle>{!isEditingMistake && <Button variant="ghost" size="sm" onClick={startEditingMistake}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader><CardContent>{isEditingMistake ? (<div className="space-y-4"><div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.mistakeAnalysis || "错因分析"}</label><Textarea value={mistakeAnalysisInput} onChange={e => setMistakeAnalysisInput(e.target.value)} rows={8} className="w-full font-mono text-sm" /></div><div className="flex gap-2"><Button size="sm" onClick={saveMistakeHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingMistake}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div></div>) : item.mistakeAnalysis ? <MarkdownRenderer content={item.mistakeAnalysis} /> : <p className="text-sm text-muted-foreground italic">{t.detail?.noMistakeAnalysis || "暂无错因分析"}</p>}</CardContent></Card>
                </div>

                <div className="space-y-6">
                    {/* WNPAPER：GeoGebra 也是"先解题再画图"，拍照收卷的题一律不挂。 */}
                    {fromPaperScan ? null : item.geogebraCommands ? (
                        <GeogebraDemo commands={item.geogebraCommands} height={700} showToolBar={true} showAlgebraInput={false} showMenuBar={false} onRegenerate={handleAnalyzeGeogebra} onSaveCommands={handleSaveGeogebraCommands} />
                    ) : (
                        <div className="rounded-lg border border-dashed p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Box className="h-4 w-4" /><span>GeoGebra 动态演示</span></div><Button variant="outline" size="sm" onClick={() => handleAnalyzeGeogebra()} disabled={isAnalyzingGeogebra}>{isAnalyzingGeogebra ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI 分析中...</> : <><Box className="mr-2 h-4 w-4" />生成演示</>}</Button></div>{geogebraError && <p className="text-xs text-muted-foreground mt-2">{geogebraError}</p>}<p className="text-xs text-muted-foreground mt-2">AI 将判断本题是否可以用 GeoGebra 进行动态演示，如适合则自动生成交互式图形</p></div>
                    )}

                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail.yourNotes}</CardTitle>{!isEditingNotes && <Button variant="ghost" size="sm" onClick={startEditingNotes}><Edit className="h-4 w-4 mr-1" />{t.detail.editNotes || "Edit"}</Button>}</div></CardHeader><CardContent>{isEditingNotes ? (<div className="space-y-3"><Textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} placeholder={t.detail.notesPlaceholder || "Enter your notes..."} rows={5} className="w-full" /><div className="flex gap-2"><Button size="sm" onClick={saveNotes}><Save className="h-4 w-4 mr-1" />{t.common.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingNotes}><X className="h-4 w-4 mr-1" />{t.common.cancel || "Cancel"}</Button></div></div>) : <div className="whitespace-pre-wrap">{item.userNotes ? <p className="text-foreground">{item.userNotes}</p> : <p className="text-muted-foreground italic">{t.detail.noNotes}</p>}</div>}</CardContent></Card>

                    {/* 题内「小老师」（2026-10-19 立，2026-10-22 改成右侧抽屉）：原来这里是
                        一张默认收起的卡片，现在抽屉挂在页面末尾 —— 入口在头部右上角
                        「问小老师」，也可由 hl-platform 错题本工具栏 postMessage 唤起。
                        正文这里不再占版面：题目和追问互不顶掉。 */}
                </div>
            </div>

            {/* 题内「小老师」抽屉（2026-10-22）：关着时整块移出视口但**不卸载**，
                追问记录留着（关掉看一眼题再打开，不用从头问）。
                WNPAPER：拍照收卷的题不挂载（它监听 `wn:tutor-open`，藏起来也会被唤起）。 */}
            {!fromPaperScan && (
                <TutorChat
                    errorItemId={item.id}
                    language={language}
                    open={tutorOpen}
                    onOpen={openTutor}
                    onClose={closeTutor}
                />
            )}

            {/* Image Viewer Modal */}
            {
                isImageViewerOpen && item?.originalImageUrl && (
                    <div
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setIsImageViewerOpen(false)}
                    >
                        <div className="relative max-w-7xl max-h-full">
                            <button
                                className="absolute -top-12 right-0 text-white hover:text-gray-300 text-lg font-semibold bg-black/50 px-4 py-2 rounded"
                                onClick={() => setIsImageViewerOpen(false)}
                            >
                                {t.detail?.close || '✕ Close'}
                            </button>
                            <img
                                src={item.originalImageUrl}
                                alt="Full size"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <p className="text-center text-white/70 text-sm mt-4">
                                {t.detail?.clickOutside || 'Click outside to close'}
                            </p>
                        </div>
                    </div>
                )
            }
        </main >
    );
}
