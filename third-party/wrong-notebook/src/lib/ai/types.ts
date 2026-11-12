// Re-export the Zod-validated type from schema.ts
export type { ParsedQuestionFromSchema as ParsedQuestion } from './schema';
import type { ParsedQuestionFromSchema } from './schema';

// Import and re-export MistakeStatus from the single source of truth
import type { MistakeStatus } from '../mistake-status';
export type { MistakeStatus };

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'harder';

export interface ReanswerQuestionResult {
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
    wrongAnswerText: string;
    mistakeAnalysis: string;
    mistakeStatus: MistakeStatus;
    // AI 顺带判断出的年级/学期与试卷等级，判断不出时为空字符串
    gradeSemester?: string;
    paperLevel?: string;
}

export interface GeogebraAnalysisResult {
    suitable: boolean;
    commands: string[];
    description: string;
}

// ─────────────────────────────────────────────────────────────
// 拍整张卷子（批次 WNPAPER）
// ─────────────────────────────────────────────────────────────
/** 收录原因：老师批错 / 空白 / 模型自判可疑 */
export type PaperEvidence = 'teacher' | 'blank' | 'model';

/**
 * 一张卷子里"要被收录的一道题"。
 * ★★★ 这个类型里**没有** answer / correctAnswer / analysis 字段，而且永远不会加 ——
 *   拍卷子这条链路的产品红线是"不给答案，防抄作业"。要加字段先想清楚这一条。
 */
export interface PaperItem {
    no: string;
    section: string;
    questionText: string;
    options: string[];
    studentAnswer: string;
    /** 只可能是 wrong / blank —— 判对的题在服务端就被丢掉了 */
    verdict: 'wrong' | 'blank';
    evidence: PaperEvidence;
    errorTag: string;
    knowledgePoints: string[];
    /** 来自第几页（1 起） */
    pageNo: number;
}

export interface PaperScanResult {
    subject: string;
    title: string;
    gradeSemester: string;
    paperLevel: string;
    pageNo: number;
    items: PaperItem[];
    stats: { total: number; wrong: number; blank: number; skipped: number };
    /** true = 这一页没认出任何题（拍糊/拍到手），前端要提示重拍 */
    empty: boolean;
}

export interface AIService {
    analyzeImage(imageBase64: string, mimeType?: string, language?: 'zh' | 'en', grade?: 7 | 8 | 9 | 10 | 11 | 12 | null, subject?: string | null, gradeSemester?: string | null): Promise<ParsedQuestionFromSchema>;
    generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language?: 'zh' | 'en', difficulty?: DifficultyLevel, gradeSemester?: string | null, opts?: { imageBase64?: string; requiresImage?: boolean }): Promise<ParsedQuestionFromSchema>;
    reanswerQuestion(questionText: string, language?: 'zh' | 'en', subject?: string | null, imageBase64?: string, gradeSemester?: string | null): Promise<ReanswerQuestionResult>;
    analyzeForGeogebra(questionText: string, answerText: string, analysis: string, previousErrors?: string): Promise<GeogebraAnalysisResult>;
    /** 题内「小老师」追问：给一段已经拼好的完整提示词，只要一段自然语言回答。 */
    answerTutorQuestion(prompt: string): Promise<string>;
    /**
     * 题内「小老师」追问（**流式**，2026-10-22 加）。
     *
     * ★★ 为什么必须有：线上实测这个网关的**首字延迟**就要 3~16 秒，而非流式要等
     *   **整段生成完**才返回（同一提示词实测 9~45 秒）。学生盯着「小老师在讲…」
     *   干等四五十秒，是「小老师很慢」这个体感的主因 —— 不是模型慢到不能看，
     *   是我们在等一个本来可以边生成边看的答案。
     *   改成流式后：首字一到就上屏，等待感从「整段时长」压到「首字延迟」。
     *
     * 契约：逐段 yield 文本**增量**（可能是空串，调用方自己跳过）；抛错即中断。
     */
    answerTutorQuestionStream(prompt: string): AsyncIterable<string>;
    /**
     * 整页试卷识别（只要错题与空白题，不给答案）。
     * ★ 声明成**可选**：Gemini / Azure 两家还没实现，线上走 OpenAI 通道。
     *   接口层发现没实现要明确报错，不许静默降级成"什么都没识别到"。
     */
    analyzePaperPage?(imageBase64: string, mimeType?: string, language?: 'zh' | 'en', pageNo?: number, subject?: string | null, gradeSemester?: string | null): Promise<PaperScanResult>;
}

export interface AIConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    // Azure OpenAI 特有字段
    azureDeployment?: string;   // Azure 部署名称
    azureApiVersion?: string;   // API 版本 (如 2024-02-15-preview)
}
