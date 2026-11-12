"use client";

import { useState, Suspense, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle, Eye, Send, XCircle, ArrowLeft, House } from "lucide-react";
import { ParsedQuestion } from "@/lib/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { apiClient } from "@/lib/api-client";
import { AppConfig } from "@/types/api";
import { frontendLogger } from "@/lib/frontend-logger";
import {
    splitAnswerParts,
    splitStemByBlanks,
    canAnswerInline,
    matchParts,
    matchWholeText,
} from "@/lib/answer-match";

export const dynamic = 'force-dynamic';

function PracticeContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const errorItemId = searchParams.get("id");
    const { t, language } = useLanguage();

    const [question, setQuestion] = useState<ParsedQuestion | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [userAnswer, setUserAnswer] = useState("");
    // ★ 2026-10-29：多空题逐空作答（用户：「举一反三也应该允许直接在题目上作答，
    //   不然对应不到答案」）。blankAnswers[i] 对应第 i 个空。
    const [blankAnswers, setBlankAnswers] = useState<string[]>([]);
    const [blankResult, setBlankResult] = useState<boolean[]>([]);
    const [notes, setNotes] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    // ★ 2026-11-01：规则判完之后请模型复核一次（只升不降）。
    //   `judging` 用来在结果卡上显示"正在复核…"，避免学生以为已经判死了。
    const [judging, setJudging] = useState(false);
    const [judgeNote, setJudgeNote] = useState("");
    // ★ 2026-11-01：答对后服务端会把这道错题自动标为已掌握，这里给个明确提示
    const [masteredNote, setMasteredNote] = useState("");
    const [config, setConfig] = useState<AppConfig | null>(null);

    // ★ 2026-11-01（报障「出题速度怎么那么慢」）：出题是一次同步模型调用，
    //   实测 10~50 秒。什么都不显示的话，学生以为卡死了、反复点。
    //   这里显示已经等了多少秒，让他知道在跑。
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!loading) { setElapsed(0); return; }
        const t0 = Date.now();
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
        return () => clearInterval(id);
    }, [loading]);

    useEffect(() => {
        apiClient.get<AppConfig>("/api/settings")
            .then(data => {
                setConfig(data);
                if (data.timeouts?.analyze) {
                    frontendLogger.info('[Config]', 'Loaded timeout settings', {
                        analyze: data.timeouts.analyze
                    });
                }
            })
            .catch(err => console.error(err));
    }, []);

    const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "harder">("medium");

    const [error, setError] = useState<string | null>(null);

    // ---- 参考答案拆成逐空 ----
    // 拆不出来（单空题 / 答案是一句话）就返回空数组，界面退回"整题一个框"的老样子。
    const answerParts = useMemo(
        () => splitAnswerParts(question?.answerText || ""),
        [question]
    );
    const stem = useMemo(
        () => splitStemByBlanks(question?.questionText || ""),
        [question]
    );
    const perBlank = !!question && answerParts.length > 1;
    // WNPAPER：拍照收卷收进来的题 answerText 是空的 —— 那是产品红线（防抄作业），
    // 不是"还没算出来"。所以它既不能拿去比对（matchWholeText 会对 null 取 trim），
    // 也不能显示答案卡。
    const hasKeyAnswer = !!(question?.answerText || "").trim();
    // ★ 只有「题干是纯文本 + 空的数量与答案段数一致」才把输入框嵌进题干里。
    //   含公式/表格的题干必须走 Markdown 渲染（块级元素里塞输入框会散），
    //   那种情况在题下按空编号作答 —— 一样能对上答案。
    const inlineMode = perBlank && stem.blanks === answerParts.length && canAnswerInline(question?.questionText || "");

    const blankLabel = (n: number) => (language === "en" ? `Blank ${n}` : `第 ${n} 空`);

    const setBlank = (i: number, v: string) => {
        setBlankAnswers(prev => {
            const next = prev.slice();
            next[i] = v;
            return next;
        });
    };

    const generateQuestion = async () => {
        if (!errorItemId) return;

        setLoading(true);
        setError(null);
        setUserAnswer("");
        setBlankAnswers([]);
        setBlankResult([]);
        setNotes("");
        setIsSubmitted(false);
        setIsCorrect(null);
        setShowAnswer(false);
        setJudgeNote("");
        setMasteredNote("");
        setJudging(false);
        try {
            const timeout = config?.timeouts?.analyze || 180000;
            frontendLogger.info('[Practice]', 'Generating question', {
                timeout
            });
            const data = await apiClient.post<ParsedQuestion>("/api/practice/generate", {
                errorItemId,
                language,
                difficulty
            }, { timeout });
            setQuestion(data);
            // 拿到新题就按答案段数铺好输入框，免得用户看到"第 3 空"却没有框
            setBlankAnswers(new Array(splitAnswerParts(data.answerText || "").length).fill(""));
        } catch (error: any) {
            console.error(error);
            const msg = error.data?.message || "";

            let errorMessage = t.practice.errors?.default || "Failed to generate";

            if (msg.includes('AI_CONNECTION_FAILED')) {
                errorMessage = t.errors?.aiConnectionFailed || errorMessage;
            } else if (msg.includes('AI_RESPONSE_ERROR')) {
                errorMessage = t.errors?.aiResponseError || errorMessage;
            } else if (msg.includes('AI_AUTH_ERROR')) {
                errorMessage = t.errors?.aiAuth || errorMessage;
            } else if (msg.includes('AI_UNKNOWN_ERROR')) {
                errorMessage = t.errors?.AI_UNKNOWN_ERROR || errorMessage;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    /**
     * 练习记录只写一次 —— 等复核出结论再写，避免同一次作答落两条、统计变脏。
     *
     * ★★ 2026-11-01 用户需求：「举一反三完成后，错题本应该自动标记为已掌握」。
     *   这里把 `errorItemId` 一并带上 —— 服务端答对后会把这道错题置为已掌握，
     *   并把 `mastered` 透回来，练习页据此提示学生（不提示的话他回错题本
     *   看到状态变了会以为是 bug）。
     */
    const saveRecord = async (ok: boolean) => {
        if (!question) return null;
        try {
            const res = await apiClient.post<{ mastered?: boolean }>("/api/practice/record", {
                subject: question.subject || "Unknown",
                difficulty,
                isCorrect: ok,
                errorItemId: errorItemId || undefined,
            });
            if (res?.mastered) {
                setMasteredNote(language === "en"
                    ? "This mistake has been marked as mastered automatically."
                    : "这道错题已自动标记为「已掌握」。");
            }
            return res;
        } catch (err) {
            console.error("Failed to save practice record:", err);
            return null;
        }
    };

    /**
     * ★★ 2026-11-01：交卷后顺手把「下一题」预生成好。
     *   学生看解析的这几秒本来空着，用来出下一道；点「再来一题」时就能秒出。
     *   ★ 不 await、不提示失败 —— 预生成失败等于没预生成，点按钮时照旧现生成。
     */
    const prefetchNext = () => {
        if (!errorItemId) return;
        apiClient.post("/api/practice/generate", {
            errorItemId, language, difficulty, prefetch: true
        }).catch(() => { /* 见上：静默失败即可 */ });
    };

    /**
     * ★★★ 2026-11-01 报障「AI 判题不准确」的真正修法。
     *
     * 判分原本是纯字符串比对（`answer-match.ts`）：参考答案写「260-130=130」，
     * 学生填「130元」⇒ 对不上 ⇒ 判错。规则层已经放宽（数值结果集 / 单位可省），
     * 但"描述性答案"（如「3日高4日低」对「3日的营业额最高…」）永远没法靠字符串判。
     * 所以规则判错时，再请模型复核一遍。
     *
     * ★ 只升不降：模型说「对」才改判，说「错」一律维持 —— 见 `practice-judge.ts`。
     * ★ 复核失败/超时 ⇒ 原样保留规则结论，并把记录按规则结果落库（绝不留空）。
     */
    const reviewWithAI = async (ruleResults: boolean[]) => {
        if (!question) return ruleResults;
        setJudging(true);
        try {
            const res = await apiClient.post<{ results: boolean[] | null; upgraded: number[] }>(
                "/api/practice/judge",
                {
                    questionText: question.questionText,
                    blanks: answerParts.map((c, i) => ({ user: blankAnswers[i] || "", correct: c })),
                    results: ruleResults,
                },
                { timeout: 32000 }
            );
            if (res && Array.isArray(res.results) && res.results.length === ruleResults.length) {
                if (res.upgraded && res.upgraded.length) {
                    setJudgeNote(
                        language === "en"
                            ? `Re-checked: ${res.upgraded.map(i => `blank ${i + 1}`).join(", ")} ${res.upgraded.length > 1 ? "were" : "was"} actually correct.`
                            : `复核了一下：${res.upgraded.map(i => `第 ${i + 1} 空`).join("、")}其实是对的，已更正。`
                    );
                }
                return res.results;
            }
        } catch (e) {
            console.error("AI judge failed, keep rule verdict:", e);
        } finally {
            setJudging(false);
        }
        return ruleResults;
    };

    const submitAnswer = async () => {
        if (!question) return;

        // WNPAPER：没有标准答案 ⇒ 只记"我做过了"，让学生回原卷自己核。
        if (!hasKeyAnswer) {
            setIsSubmitted(true);
            setShowAnswer(false);
            setBlankResult([]);
            setIsCorrect(false);
            setJudging(false);
            setJudgeNote("");
            setMasteredNote("");
            return;
        }

        // ---- 多空题：逐空比对 ----
        if (perBlank) {
            if (!blankAnswers.some(v => (v || "").trim())) return;
            const per = matchParts(blankAnswers, answerParts);
            setBlankResult(per);
            setIsCorrect(per.every(Boolean));
            setIsSubmitted(true);
            setShowAnswer(true);
            setJudgeNote("");
            setMasteredNote("");
            prefetchNext();

            if (per.every(Boolean)) {
                await saveRecord(true);
                return;
            }
            // 有判错的空 ⇒ 复核一次再落库
            const final = await reviewWithAI(per);
            setBlankResult(final);
            setIsCorrect(final.every(Boolean));
            await saveRecord(final.every(Boolean));
            return;
        }

        // ---- 单空题：整串比对（matchWholeText 也顺手修好了"多空却只有一个框"的老题）----
        if (!userAnswer.trim()) return;

        setIsSubmitted(true);
        setBlankResult([]);
        setJudgeNote("");
        setMasteredNote("");

        const isMatch = matchWholeText(userAnswer, question.answerText);
        setIsCorrect(isMatch);
        setShowAnswer(true);
        prefetchNext();

        if (isMatch) {
            await saveRecord(true);
            return;
        }

        setJudging(true);
        try {
            const res = await apiClient.post<{ results: boolean[] | null; upgraded: number[] }>(
                "/api/practice/judge",
                {
                    questionText: question.questionText,
                    blanks: [{ user: userAnswer, correct: question.answerText }],
                    results: [false],
                },
                { timeout: 32000 }
            );
            const ok = !!(res && Array.isArray(res.results) && res.results[0] === true);
            if (ok) {
                setIsCorrect(true);
                setJudgeNote(language === "en"
                    ? "Re-checked: your answer is actually correct."
                    : "复核了一下：你答的其实是对的，已更正。");
            }
            await saveRecord(ok);
        } catch (e) {
            console.error("AI judge failed, keep rule verdict:", e);
            await saveRecord(false);
        } finally {
            setJudging(false);
        }
    };

    if (!errorItemId) {
        return <div className="p-8 text-center">{t.practice.invalidRequest || "Invalid Request"}</div>;
    }

    const canSubmit = perBlank
        ? blankAnswers.some(v => (v || "").trim())
        : !!userAnswer.trim();

    /** 题干里嵌的那一个输入框（内联作答） */
    const renderBlankInput = (i: number, extraClass = "") => (
        <Input
            value={blankAnswers[i] || ""}
            onChange={(e) => setBlank(i, e.target.value)}
            disabled={isSubmitted}
            aria-label={blankLabel(i + 1)}
            placeholder={blankLabel(i + 1)}
            className={
                "inline-block align-middle mx-1 h-9 w-24 text-center text-base " +
                (isSubmitted
                    ? (blankResult[i] ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50")
                    : "") +
                extraClass
            }
        />
    );

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex justify-between items-center mb-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t.common?.back || "返回"}
                </Button>
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <House className="h-5 w-5" />
                    </Button>
                </Link>
            </div>
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">{t.practice.title}</h1>
                <p className="text-muted-foreground">
                    {t.practice.subtitle}
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">{t.common?.error || "Error"}: </strong>
                        <span className="block whitespace-pre-wrap"> {error}</span>
                    </div>
                )}

                {!question && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">{t.practice.difficulty?.label || "Difficulty"}:</span>
                            <div className="flex gap-1">
                                {[
                                    { value: "easy", label: t.practice.difficulty?.easy || "Easy", color: "bg-green-100 text-green-700 hover:bg-green-200" },
                                    { value: "medium", label: t.practice.difficulty?.medium || "Medium", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
                                    { value: "hard", label: t.practice.difficulty?.hard || "Hard", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
                                    { value: "harder", label: t.practice.difficulty?.harder || "Challenge", color: "bg-red-100 text-red-700 hover:bg-red-200" }
                                ].map((level) => (
                                    <button
                                        key={level.value}
                                        onClick={() => setDifficulty(level.value as any)}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${difficulty === level.value
                                            ? level.color.replace("bg-", "bg-opacity-100 bg-").replace("text-", "ring-2 ring-offset-1 ring-")
                                            : "bg-transparent hover:bg-muted text-muted-foreground"
                                            } ${difficulty === level.value ? level.color : ''}`}
                                    >
                                        {level.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button size="lg" onClick={generateQuestion} disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t.practice.generating}
                                    {elapsed > 0 ? ` ${elapsed}s` : ""}
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    {t.practice.generate}
                                </>
                            )}
                        </Button>
                        {loading && elapsed > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {language === "en"
                                    ? `Waiting ${elapsed}s — usually 10–30s. Please don't click again.`
                                    : `已等 ${elapsed} 秒，出题通常需要 10~30 秒，请稍候（别重复点）。`}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {question && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-primary/50 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <span>{t.app.practiceProblem}</span>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value as any)}
                                        className="h-8 text-xs border rounded px-2 bg-background"
                                        disabled={loading}
                                    >
                                        <option value="easy">{t.practice.difficulty?.easy || "Easy"}</option>
                                        <option value="medium">{t.practice.difficulty?.medium || "Medium"}</option>
                                        <option value="hard">{t.practice.difficulty?.hard || "Hard"}</option>
                                        <option value="harder">{t.practice.difficulty?.harder || "Challenge"}</option>
                                    </select>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={generateQuestion}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {t.practice.generating}
                                                {elapsed > 0 ? ` ${elapsed}s` : ""}
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                {t.practice.regenerate}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* ★ 2026-10-29：多空题**直接在题干上作答** ——
                                把 `__` 换成输入框，一个空对一个答案，学生不会再把
                                "60 60 1 0.5" 挤在一个框里、判分也就对得上了。
                                ★ 题干含公式/表格时不走这条路（Markdown 块级元素里塞输入框会散），
                                  改为题下按空编号；两条路的判分口径是同一个 matchParts。 */}
                            {inlineMode ? (
                                <div className="text-lg leading-9 whitespace-pre-wrap break-words">
                                    {stem.segs.map((seg, i) => (
                                        <span key={i}>
                                            {seg}
                                            {i < stem.blanks && renderBlankInput(i)}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <MarkdownRenderer content={question.questionText} className="font-medium" />
                            )}
                            {/* 变式题配图（2026-10-19）：原题靠图才能做时，模型会连图一起生成。
                                内容是**已经过白名单过滤的内联 SVG**（服务端 sanitizeFigure 过一遍，
                                这里再兜一遍），所以可以直接渲染；见 lib/ai/figure-sanitize.ts。 */}
                            {question.figure?.content && (
                                <div className="mt-4 flex justify-center">
                                    <div
                                        className="rounded-lg border bg-white p-3 max-w-full [&>svg]:h-auto [&>svg]:max-w-full"
                                        style={{ width: '100%' }}
                                        // eslint-disable-next-line react/no-danger
                                        dangerouslySetInnerHTML={{ __html: question.figure.content }}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>


                    {/* Answer Input Section */}
                    <Card className="border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-blue-600">
                                {t.app.yourAnswer || "你的答案"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {inlineMode ? (
                                // 内联模式：输入框已经在题干里了，这里只留一句说明
                                <p className="text-sm text-muted-foreground">
                                    {language === "en"
                                        ? "Fill the blanks directly in the problem above."
                                        : "请直接在上面题目的空格里作答。"}
                                </p>
                            ) : perBlank ? (
                                // 拆得出多个空、但题干不适合内联：按空编号作答
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {answerParts.map((_, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="shrink-0 text-sm text-muted-foreground">{blankLabel(i + 1)}</span>
                                            <Input
                                                value={blankAnswers[i] || ""}
                                                onChange={(e) => setBlank(i, e.target.value)}
                                                disabled={isSubmitted}
                                                aria-label={blankLabel(i + 1)}
                                                className={
                                                    "flex-1 text-lg " +
                                                    (isSubmitted
                                                        ? (blankResult[i] ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50")
                                                        : "")
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Input
                                    placeholder={t.app.answerPlaceholder || "输入你的答案..."}
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    disabled={isSubmitted}
                                    className="text-lg"
                                />
                            )}
                            <Textarea
                                placeholder={t.app.notesPlaceholder || "记录解题思路（可选）..."}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isSubmitted}
                                rows={3}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit/Result Section */}
                    {!isSubmitted ? (
                        <div className="flex justify-center">
                            <Button
                                size="lg"
                                onClick={submitAnswer}
                                disabled={!canSubmit}
                                className="w-full md:w-auto"
                            >
                                <Send className="mr-2 h-4 w-4" />
                                {t.app.submitAnswer || "提交答案"}
                            </Button>
                        </div>
                    ) : (
                        <Card className={!hasKeyAnswer ? "border-dashed bg-muted/40" : isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3 mb-4">
                                    {!hasKeyAnswer ? (
                                        <div>
                                            <h3 className="text-lg font-bold">
                                                {language === "en" ? "Filed from a paper scan" : "这道题是从卷子上收进来的"}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {language === "en"
                                                    ? "There is no answer to check against — that is on purpose. Open the original paper and check your work yourself."
                                                    : "没有标准答案可对（这是故意的，防止照抄）。翻开原卷，自己核对一遍。"}
                                            </p>
                                        </div>
                                    ) : isCorrect ? (
                                        <>
                                            <CheckCircle className="h-8 w-8 text-green-600" />
                                            <div>
                                                <h3 className="text-xl font-bold text-green-600">
                                                    {t.practice.correct || "回答正确！"}
                                                </h3>
                                                <p className="text-green-700">
                                                    {t.practice.correctMessage || "太棒了，继续保持！"}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="h-8 w-8 text-red-600" />
                                            <div>
                                                <h3 className="text-xl font-bold text-red-600">
                                                    {t.practice.incorrect || "答案有误"}
                                                </h3>
                                                <p className="text-red-700">
                                                    {t.practice.incorrectMessage || "再看看解析，加油！"}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {/* ★ 2026-11-01：规则判错后还会请模型复核一次（只升不降）。
                                    复核期间必须明确告诉学生"还在判"，否则他以为已经判死了。 */}
                                {judging && (
                                    <p className="mb-3 flex items-center gap-2 text-sm text-blue-700">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {language === "en"
                                            ? "Re-checking with AI… (may take ~20s; you can read the analysis meanwhile)"
                                            : "正在让 AI 复核一下…（可能要十几秒，你可以先看下面的解析）"}
                                    </p>
                                )}
                                {judgeNote && (
                                    <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
                                        {judgeNote}
                                    </p>
                                )}
                                {/* ★ 2026-11-01：答对后错题本会自动变成「已掌握」，必须告诉学生，
                                    否则他回错题本看到状态变了会以为是 bug。 */}
                                {masteredNote && (
                                    <p className="mb-3 flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
                                        <CheckCircle className="h-4 w-4" />
                                        {masteredNote}
                                    </p>
                                )}
                                {/* ★ 逐空反馈：只说哪几空错了、应该填什么 —— 学生不用自己一行行对答案 */}
                                {perBlank && blankResult.length > 0 && (
                                    <div className="mb-4 space-y-1 text-sm">
                                        {answerParts.map((p, i) => (blankResult[i] ? null : (
                                            <div key={i} className="text-red-700">
                                                {language === "en"
                                                    ? `${blankLabel(i + 1)}: you wrote "${(blankAnswers[i] || "").trim() || "(empty)"}", the answer is "${p}"`
                                                    : `${blankLabel(i + 1)}：你填的是「${(blankAnswers[i] || "").trim() || "（空）"}」，应为「${p}」`}
                                            </div>
                                        )))}
                                    </div>
                                )}
                                {notes && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border">
                                        <p className="text-sm font-medium text-gray-600 mb-1">
                                            {t.practice.yourNotes || "你的笔记："}
                                        </p>
                                        <p className="text-gray-700 whitespace-pre-wrap">{notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {showAnswer && hasKeyAnswer && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                            <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle className="text-green-600">{t.practice.correctAnswer}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <MarkdownRenderer content={question.answerText} className="font-bold" />
                                </CardContent>
                            </Card>


                            <Card>
                                <CardHeader>
                                    <CardTitle>{t.practice.detailedAnalysis}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <MarkdownRenderer content={question.analysis} />
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PracticePage() {
    return (
        <main className="min-h-screen p-8 bg-background">
            <Suspense fallback={
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            }>
                <PracticeContent />
            </Suspense>
        </main>
    );
}
