import OpenAI from "openai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig, ReanswerQuestionResult, GeogebraAnalysisResult } from "./types";
import { generateAnalyzePrompt, generateSimilarQuestionPrompt, generateGeogebraPrompt } from './prompts';
import { getAppConfig } from '../config';
import { safeParseParsedQuestion } from './schema';
import { sanitizeFigure } from './figure-sanitize';
import { getMathTagsFromDB, getTagsFromDB } from './tag-service';
import { createLogger } from '../logger';
import { normalizeMistakeStatusForSave } from '../mistake-status';

const logger = createLogger('ai:openai');

type OpenAIUserContent = string | Array<
    { type: "text"; text: string } |
    { type: "image_url"; image_url: { url: string } }
>;

/**
 * 归一化 AI 返回的试卷等级。模型可能返回 "A卷"、"a"、"b卷/提高" 等写法，
 * 统一映射为 a/b/other；无法识别时返回空串，由前端回退到默认值。
 */
function normalizePaperLevel(raw: string | null): string {
    if (!raw) return "";
    const v = raw.trim().toLowerCase();
    if (v.includes('b')) return 'b';
    if (v.includes('a')) return 'a';
    if (v.includes('other') || v.includes('其他')) return 'other';
    return "";
}

/**
 * 判断这次失败是否只是「网关/模型不认我们多塞的那个可选参数」。
 *
 * 只认 400/422 这一类**请求体被拒**，且错误文本里确实点名了参数或"未知/不支持字段"。
 * 其它 400（例如图片过大、消息格式错）不在此列 —— 那种情况下原样抛出，
 * 因为换个参数重试也救不回来，只会白白多花一次额度。
 */
function isUnknownParamError(err: unknown): boolean {
    const anyErr: any = err as any;
    const status = anyErr?.status ?? anyErr?.response?.status;
    if (status !== 400 && status !== 422) return false;
    const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
    if (msg.includes('enable_thinking') || msg.includes('enablethinking')) return true;
    return (
        msg.includes('unrecognized') ||
        msg.includes('unknown') ||
        msg.includes('unsupported') ||
        msg.includes('not supported') ||
        msg.includes('extra field') ||
        msg.includes('unexpected')
    );
}

export class OpenAIProvider implements AIService {
    private openai: OpenAI;
    private model: string;
    private baseURL: string;
    private apiKey: string;
    private isLongCat: boolean;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey;
        const baseURL = config?.baseUrl;

        if (!apiKey) {
            throw new Error("AI_AUTH_ERROR: OPENAI_API_KEY is required for OpenAI provider");
        }

        this.openai = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL || undefined,
            defaultHeaders: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            // ★★★ 2026-11-12（用户报障「拍照识别为什么这么慢」）：
            //   SDK 默认 `timeout: 600000`（10 分钟）+ `maxRetries: 2` —— 也就是说网关
            //   抖一次，SDK 会**在后台自己重试两次**，前端只能干等；实测线上三次真实拍照
            //   分析耗时 30.5s / 75.4s / 184.3s，波动 6 倍，任何一次抖都可能叠成几分钟。
            //   ① timeout 280s：略小于前端 300s（config.timeouts.analyze），让**服务端先超时**
            //      并返回明确的 AI_TIMEOUT_ERROR，而不是前端先 abort、服务端还在白跑
            //      （那种情况下用户看到"失败了"，其实 3 秒后就算完了，结果直接丢掉）；
            //   ② maxRetries 1：真·容量错误（429/5xx）还留一次机会，但不再叠成 3 倍时长。
            timeout: 280000,
            maxRetries: 1,
        });

        this.model = config?.model || 'gpt-4o'; // Fallback for safety
        this.baseURL = baseURL || 'https://api.openai.com/v1';
        this.apiKey = apiKey;
        this.isLongCat = this.baseURL.includes('longcat.chat');

        logger.info({
            provider: 'OpenAI',
            model: this.model,
            baseURL: this.baseURL,
            apiKeyPrefix: apiKey.substring(0, 8) + '...'
        }, 'AI Provider initialized');
    }

    private adaptMessagesForLongCat(messages: Array<{ role: string; content: any }>): Array<{ role: string; content: any }> {
        return messages.map(msg => {
            if (typeof msg.content === 'string') {
                return { ...msg, content: [{ type: 'text', text: msg.content }] };
            }
            if (Array.isArray(msg.content)) {
                const adapted = msg.content.map((part: any) => {
                    if (part.type === 'image_url') {
                        return {
                            type: 'input_image',
                            input_image: { data: [part.image_url.url], type: 'url' }
                        };
                    }
                    return part;
                });
                return { ...msg, content: adapted };
            }
            return msg;
        });
    }

    private extractTag(text: string, tagName: string): string | null {
        const startTag = `<${tagName}>`;
        const endTag = `</${tagName}>`;
        const startIndex = text.indexOf(startTag);

        // 如果找不到开始标签，返回 null
        if (startIndex === -1) {
            return null;
        }

        const contentStartIndex = startIndex + startTag.length;
        const endIndex = text.lastIndexOf(endTag);

        // 特殊处理：如果闭合标签丢失（通常主要发生在最后的 analysis 标签被截断时）
        // 我们尝试读取到字符串末尾
        if (endIndex === -1 && tagName === 'analysis') {
            logger.warn({ tagName }, 'Tag was verified unclosed, treating as truncated and reading to end');
            return text.substring(contentStartIndex).trim();
        }

        if (endIndex === -1 || contentStartIndex >= endIndex) {
            return null;
        }

        return text.substring(contentStartIndex, endIndex).trim();
    }

    private parseResponse(text: string): ParsedQuestion {
        logger.debug({ textLength: text.length }, 'Parsing AI response');

        const questionText = this.extractTag(text, "question_text");
        const answerText = this.extractTag(text, "answer_text");
        const analysis = this.extractTag(text, "analysis");
        const subjectRaw = this.extractTag(text, "subject");
        const knowledgePointsRaw = this.extractTag(text, "knowledge_points");
        const requiresImageRaw = this.extractTag(text, "requires_image");
        const wrongAnswerText = this.extractTag(text, "wrong_answer_text") || "";
        const mistakeAnalysis = this.extractTag(text, "mistake_analysis") || "";
        const mistakeStatusRaw = this.extractTag(text, "mistake_status");
        const gradeSemester = (this.extractTag(text, "grade_semester") || "").trim();
        const paperLevel = normalizePaperLevel(this.extractTag(text, "paper_level"));

        // Basic Validation
        if (!questionText || !answerText || !analysis) {
            logger.error({ rawTextSample: text.substring(0, 500) }, 'Missing critical XML tags');
            throw new Error("Invalid AI response: Missing critical XML tags (<question_text>, <answer_text>, or <analysis>)");
        }

        // Process Subject
        let subject: ParsedQuestion['subject'] = '其他';
        const validSubjects: ParsedQuestion['subject'][] = ["数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他"];
        if (subjectRaw && (validSubjects as string[]).includes(subjectRaw)) {
            subject = subjectRaw as ParsedQuestion['subject'];
        }

        // Process Knowledge Points
        let knowledgePoints: string[] = [];
        if (knowledgePointsRaw) {
            // Split by comma or newline, trim whitespaces
            knowledgePoints = knowledgePointsRaw.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);
        }

        // Process requiresImage (default to false if not present or unrecognized)
        const requiresImage = requiresImageRaw?.toLowerCase().trim() === 'true';
        const mistakeStatus = normalizeMistakeStatusForSave(mistakeStatusRaw, wrongAnswerText);

        // Process figure（2026-10-19）：变式题配图，模型按 <figure>…</figure> 返回内联 SVG
        const figureRaw = this.extractTag(text, "figure");
        const figure = sanitizeFigure(figureRaw);

        // Construct Result
        const result: ParsedQuestion = {
            questionText,
            answerText,
            analysis,
            wrongAnswerText,
            mistakeAnalysis,
            mistakeStatus,
            subject,
            knowledgePoints,
            requiresImage,
            figure,
            gradeSemester,
            paperLevel
        };

        // Final Schema Validation (just to be safe, though likely compliant by now)
        const validation = safeParseParsedQuestion(result);
        if (validation.success) {
            logger.debug('Validated successfully via XML tags');
            return validation.data;
        } else {
            logger.warn({ validationError: validation.error.format() }, 'Schema validation warning');
            // We still return it as we trust our extraction more than the schema at this point (or we can throw)
            // Let's return the extracted data to be permissive
            return result;
        }
    }

    async analyzeImage(imageBase64: string, mimeType: string = "image/jpeg", language: 'zh' | 'en' = 'zh', grade?: 7 | 8 | 9 | 10 | 11 | 12 | null, subject?: string | null, gradeSemester?: string | null): Promise<ParsedQuestion> {
        const config = getAppConfig();

        // 从数据库获取各学科标签
        // 如果指定了学科，只获取该学科；否则获取所有学科标签供 AI 判断
        // ★ 2026-11-12：原来是 5 个串行 `await`。学科为空时要连打 5 次库，
        //   每次都几十毫秒地排队（这几条只是拼提示词用的标签，彼此无依赖）。
        //   改并行：语义一模一样，省掉的是叠加的往返。收益不大，但它是"用户已经
        //   点了上传、页面却还没动静"那一段里唯一的本地耗时。
        const [prefetchedMathTags, prefetchedPhysicsTags, prefetchedChemistryTags, prefetchedBiologyTags, prefetchedEnglishTags] =
            await Promise.all([
                (subject === '数学' || !subject) ? getMathTagsFromDB(grade || null) : Promise.resolve([] as any),
                (subject === '物理' || !subject) ? getTagsFromDB('physics') : Promise.resolve([] as any),
                (subject === '化学' || !subject) ? getTagsFromDB('chemistry') : Promise.resolve([] as any),
                (subject === '生物' || !subject) ? getTagsFromDB('biology') : Promise.resolve([] as any),
                (subject === '英语' || !subject) ? getTagsFromDB('english') : Promise.resolve([] as any),
            ]);

        const systemPrompt = generateAnalyzePrompt(language, grade, subject, {
            customTemplate: config.prompts?.analyze,
            prefetchedMathTags,
            prefetchedPhysicsTags,
            prefetchedChemistryTags,
            prefetchedBiologyTags,
            prefetchedEnglishTags,
        }, gradeSemester);

        logger.box('🔍 AI Image Analysis Request', {
            provider: 'OpenAI',
            endpoint: `${this.baseURL}/chat/completions`,
            imageSize: `${imageBase64.length} bytes`,
            mimeType,
            model: this.model,
            language,
            grade: grade || 'all'
        });
        logger.box('📝 Full System Prompt', systemPrompt);

        try {
            // 构建请求参数（用于日志显示，图片数据截断）
            const requestParamsForLog = {
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,[...${imageBase64.length} bytes base64 data...]`,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 8192,
            };

            logger.box('📤 API Request (发送给 AI 的原始请求)', JSON.stringify(requestParamsForLog, null, 2));

            let response: any;

            if (this.isLongCat) {
                // LongCat 使用不同的多模态格式，绕过 SDK 直接请求
                const messages = this.adaptMessagesForLongCat([
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`,
                                },
                            },
                        ],
                    },
                ]);

                const res = await fetch(`${this.baseURL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages,
                        max_tokens: 8192,
                    }),
                });

                if (!res.ok) {
                    const errBody = await res.text();
                    logger.error({ status: res.status, body: errBody }, 'LongCat API error');
                    throw new Error(`${res.status} status code (${errBody})`);
                }

                response = await res.json();
            } else {
                const messages: any = [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`,
                                },
                            },
                        ],
                    },
                ];
                const baseParams: any = {
                    model: this.model,
                    messages,
                    // response_format: { type: "json_object" }, // Removing to improve compatibility with 3rd party providers
                    max_tokens: 8192,
                };

                // ★★★ 2026-11-12（用户报障「拍照识别为什么这么慢」）——最大的一处提速：
                //   把上游模型的**思考链关掉**。
                //   线上真日志三次真实拍照分析：30.5s / 75.4s / 184.3s（全部成功，只是慢）。
                //   同图同提示词（线上真提示词 6213 字符）A/B 实测：
                //     · 开思考：25.4s，reasoning_tokens=646，reasoning_len=1041，completion=2173
                //     · 关思考：11.4s，reasoning_tokens=0，  reasoning_len=0，   completion=1009
                //              正文 1665 字符（不短）、finish=stop、JSON 结构完整
                //   ⇒ 这一步干的活是「认字 + 抄题干 + 打标签」，不吃链式推理；思考只让用户干等，
                //     还会把 completion 预算翻倍（思考+正文共用一个 max_tokens 池）。
                //
                // ★ 但**提速参数绝不允许成为单点故障**：网关/模型换代后可能不认这个字段，
                //   400 报未知参数。所以下面 catch 里重试一次"只去掉这个字段"的请求——
                //   宁可慢回去，也不能因为一个优化项把「拍照收题」整条链路打挂。
                try {
                    response = await this.openai.chat.completions.create({ ...baseParams, enable_thinking: false } as any);
                } catch (fastErr) {
                    if (!isUnknownParamError(fastErr)) throw fastErr;
                    logger.warn(
                        { error: fastErr instanceof Error ? fastErr.message : String(fastErr) },
                        '⚠️ 网关不认 enable_thinking，已退回不关思考的请求（会慢一些，但识别功能不受影响）'
                    );
                    response = await this.openai.chat.completions.create(baseParams);
                }
            }

            logger.box('📦 Full API Response', JSON.stringify(response, null, 2));

            // 检查响应是否有效
            if (!response || !response.choices || response.choices.length === 0) {
                logger.error({ response: JSON.stringify(response) }, 'Invalid API response - no choices array');
                throw new Error("AI_RESPONSE_ERROR: API returned empty or invalid response");
            }

            const text = response.choices[0]?.message?.content || "";

            logger.box('🤖 AI Raw Response', text);

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text);

            logger.box('✅ Parsed & Validated Result', JSON.stringify(parsedResult, null, 2));

            return parsedResult;

        } catch (error) {
            logger.box('❌ Error during AI analysis', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            this.handleError(error);
            throw error;
        }
    }

    async generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh', difficulty: DifficultyLevel = 'medium', gradeSemester?: string | null, opts?: { imageBase64?: string; requiresImage?: boolean }): Promise<ParsedQuestion> {
        const config = getAppConfig();
        const imageBase64 = opts?.imageBase64;
        const systemPrompt = generateSimilarQuestionPrompt(language, originalQuestion, knowledgePoints, difficulty, {
            customTemplate: config.prompts?.similar
        }, gradeSemester, { requiresImage: opts?.requiresImage, hasImage: !!imageBase64 });
        const userPrompt = `\nOriginal Question: "${originalQuestion}"\nKnowledge Points: ${knowledgePoints.join(", ")}\n    `;

        logger.box('🎯 Generate Similar Question Request', {
            provider: 'OpenAI',
            endpoint: `${this.baseURL}/chat/completions`,
            model: this.model,
            originalQuestion: originalQuestion.substring(0, 100) + '...',
            knowledgePoints: knowledgePoints.join(', '),
            difficulty,
            language,
            hasImage: !!imageBase64,
            requiresImage: !!opts?.requiresImage
        });
        logger.box('📝 System Prompt', systemPrompt);
        logger.box('📝 User Prompt', userPrompt);

        try {
            // ★ 2026-10-19：原题依赖图形时，把原题图一并喂进去，模型才能画出同类型的变式图。
            let userContent: OpenAIUserContent = userPrompt;
            if (imageBase64) {
                userContent = [
                    { type: "text", text: userPrompt },
                    { type: "image_url", image_url: { url: imageBase64 } },
                ];
            }

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                ],
                // response_format: { type: "json_object" }, // Removing to improve compatibility with 3rd party providers
                // ★★ 2026-11-01（用户报障「举一反三出题速度怎么那么慢」）：
                //   同一网关、同一提示词实测出题耗时 10 秒 ~ 52 秒，差距全在**思考 token**
                //   （usage.completion_tokens_details.reasoning_tokens 实测 374 ~ 2656）。
                //   出题是"给个模板往里填"的活，不需要长思考；关掉后尾延迟消失、方差也消失。
                //   ★ 字段不在 OpenAI SDK 类型里，但网关认（`answerTutorQuestionStream` 已在用同一写法）。
                thinking: { type: 'disabled' },
                // ★ 8192 是给"思考 + 正文"共用的预算，关思考后 3000 足够
                //   （实测一道带解析的题正文 900~1600 字符）。留太多只会让模型话更多。
                max_tokens: 3000,
            } as any);

            const text = response.choices[0]?.message?.content || "";

            logger.box('🤖 AI Raw Response', text);

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text);

            logger.box('✅ Parsed & Validated Result', JSON.stringify(parsedResult, null, 2));

            return parsedResult;

        } catch (error) {
            logger.box('❌ Error during question generation', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            this.handleError(error);
            throw error;
        }
    }

    async reanswerQuestion(questionText: string, language: 'zh' | 'en' = 'zh', subject?: string | null, imageBase64?: string, gradeSemester?: string | null): Promise<ReanswerQuestionResult> {
        const { generateReanswerPrompt } = await import('./prompts');
        const prompt = generateReanswerPrompt(language, questionText, subject, undefined, gradeSemester);

        logger.info({
            provider: 'OpenAI',
            endpoint: `${this.baseURL}/chat/completions`,
            model: this.model,
            questionLength: questionText.length,
            subject: subject || 'auto',
            hasImage: !!imageBase64
        }, 'Reanswer Question Request');
        logger.debug({ prompt }, 'Full prompt');

        try {
            // 根据是否有图片构建不同的消息内容
            let userContent: OpenAIUserContent = "请根据上述题目提供答案和解析。";
            if (imageBase64) {
                // 如果有图片，构建多模态消息
                const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
                logger.debug({ imageLength: imageUrl.length }, 'Image added to request');
                userContent = [
                    { type: "text", text: "请结合图片和题目描述提供答案和解析。" },
                    { type: "image_url", image_url: { url: imageUrl } }
                ];
            } else {
                logger.debug({ imageBase64Type: typeof imageBase64, hasValue: !!imageBase64 }, 'No image data');
            }

            // 打印请求参数
            const requestParams = {
                model: this.model,
                messages: [
                    { role: "system", content: prompt.substring(0, 200) + "..." },
                    { role: "user", content: typeof userContent === 'string' ? userContent : "[包含图片的多模态消息]" }
                ],
                max_tokens: 8192
            };
            logger.debug({ requestParams }, 'Request parameters');

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: userContent }
                ],
                max_tokens: 8192,
            });

            logger.debug({ response: JSON.stringify(response) }, 'Full API response');

            // 检查响应是否有效
            if (!response || !response.choices || response.choices.length === 0) {
                logger.error({ response: JSON.stringify(response) }, 'Invalid API response - no choices array');
                throw new Error("AI_RESPONSE_ERROR: API returned empty or invalid response");
            }

            const text = response.choices[0]?.message?.content || "";

            logger.debug({ rawResponse: text }, 'AI raw response');

            if (!text) throw new Error("Empty response from AI");

            // 解析响应
            const answerText = this.extractTag(text, "answer_text") || "";
            const analysis = this.extractTag(text, "analysis") || "";
            const knowledgePointsRaw = this.extractTag(text, "knowledge_points") || "";
            const knowledgePoints = knowledgePointsRaw.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);
            const wrongAnswerText = this.extractTag(text, "wrong_answer_text") || "";
            const mistakeAnalysis = this.extractTag(text, "mistake_analysis") || "";
            const mistakeStatus = normalizeMistakeStatusForSave(
                this.extractTag(text, "mistake_status"),
                wrongAnswerText
            );
            const gradeSemester = (this.extractTag(text, "grade_semester") || "").trim();
            const paperLevel = normalizePaperLevel(this.extractTag(text, "paper_level"));

            logger.info('Reanswer parsed successfully');

            return { answerText, analysis, knowledgePoints, wrongAnswerText, mistakeAnalysis, mistakeStatus, gradeSemester, paperLevel };

        } catch (error) {
            logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Error during reanswer');
            this.handleError(error);
            throw error;
        }
    }

    /** 题内「小老师」追问（2026-10-19）。理由见 gemini-provider 同名方法。 */
    async answerTutorQuestion(prompt: string): Promise<string> {
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1024,
            });
            const text = response.choices[0]?.message?.content || "";
            if (!text) throw new Error("Empty response from AI");
            return text.trim();
        } catch (error) {
            logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error during tutor answer');
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 题内「小老师」追问 —— **流式**（2026-10-22）。
     *
     * ★ 模型单独可配（`AI_TUTOR_MODEL`）：同一网关、同一提示词实测首字延迟
     *   `qwen/qwen3.8-flash-next` 6.7~16.4 秒，`deepseek/deepseek-v4.1-flash` 2.9~6.0 秒。
     *   追问是「学生当下卡住」的场景，首字延迟直接等于体感，所以给这一条链路单独留了开关；
     *   不配就沿用全局 `OPENAI_MODEL`，别的功能（拍照识别/解析/出题）一行都不受影响。
     *
     * ★ 为什么不在这里做「失败重试」：流式一旦已经吐了字，重试就得处理"半截答案"，
     *   而追问是学生看着屏幕的对话 —— 吐了一半再重来比直接报错更让人困惑。
     *   失败就让前端把空回答撤掉、把问题放回输入框（与旧的整段失败同一套收尾）。
     */
    async *answerTutorQuestionStream(prompt: string): AsyncIterable<string> {
        const model = process.env.AI_TUTOR_MODEL || this.model;
        // ★★ 必须关掉「思考」（thinking）。
        //   这个网关上的 deepseek 系模型默认先吐一段 `reasoning_content`（实测 300+ 字，
        //   难题上更长），而 `max_tokens` 是**思考 + 正文共用一个预算** ⇒ 思考吃光预算，
        //   正文就成了空串。线上真踩过：8 秒后 replyChars=0，学生只看到「小老师连不上」。
        //   hl-platform 的非思考档位用的是同一写法（server/llm.js: thinking:{type:'disabled'}）。
        //   ★ 这个字段不在 OpenAI SDK 的类型里，但网关认；万一哪天被 SDK 吞掉也不致命 ——
        //     下面还有「空流兜底」，行为只是退回旧版（多等一轮）。
        const base: any = {
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1500,
            thinking: { type: 'disabled' },
        };
        try {
            // ★ 显式 `as any`：`base` 是 any，展开后 TS 会挑到**非流式**重载，
            //   于是 `stream` 被推断成 ChatCompletion（不可 for-await）。断言一下即可。
            const stream: any = await this.openai.chat.completions.create({ ...base, stream: true } as any);
            let n = 0;
            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (!delta) continue;
                n += delta.length;
                yield delta;
            }
            if (n) return;
            // ★★ 兜底：上游偶发空流（只有思考没有正文，或者干脆什么都不给）。
            //   宁可比别人慢一轮，也不要让学生看到「问过了但没有回答」——
            //   那种"静默失败"最难理解，他会以为是自己点错了。
            logger.warn({ model }, 'Tutor stream empty, retry non-stream');
            const res: any = await this.openai.chat.completions.create(base);
            const text = String(res?.choices?.[0]?.message?.content || '').trim();
            if (text) yield text;
        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : String(error),
                model,
            }, 'Error during tutor stream');
            this.handleError(error);
            throw error;
        }
    }

    async analyzeForGeogebra(questionText: string, answerText: string, analysis: string, previousErrors?: string): Promise<GeogebraAnalysisResult> {
        const prompt = generateGeogebraPrompt(questionText, answerText, analysis, previousErrors);

        logger.info({
            provider: 'OpenAI',
            model: this.model,
            questionLength: questionText.length,
        }, 'GeoGebra Analysis Request');

        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: "请分析上述题目并生成 GeoGebra 演示命令。" }
                ],
                max_tokens: 4096,
            });

            const text = response.choices[0]?.message?.content || '';
            logger.debug({ rawResponse: text }, 'GeoGebra AI raw response');

            if (!text) throw new Error("Empty response from AI");

            // Extract JSON from response (handle possible markdown code blocks)
            let jsonStr = text.trim();
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }

            // Try to find JSON object
            const objStart = jsonStr.indexOf('{');
            const objEnd = jsonStr.lastIndexOf('}');
            if (objStart !== -1 && objEnd !== -1) {
                jsonStr = jsonStr.substring(objStart, objEnd + 1);
            }

            const parsed = JSON.parse(jsonStr);

            return {
                suitable: Boolean(parsed.suitable),
                commands: Array.isArray(parsed.commands) ? parsed.commands : [],
                description: parsed.description || "",
            };
        } catch (error) {
            logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Error during GeoGebra analysis');
            this.handleError(error);
            throw error;
        }
    }

    private handleError(error: unknown) {
        logger.error({ error }, 'OpenAI error');
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('connect')) {
                throw new Error("AI_CONNECTION_FAILED");
            }
            // 超时错误 (包括 408 Request Timeout)
            if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted') || msg.includes('408')) {
                throw new Error("AI_TIMEOUT_ERROR");
            }
            // 配额/频率限制错误
            if (msg.includes('quota') || msg.includes('额度') || msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
                throw new Error("AI_QUOTA_EXCEEDED");
            }
            // 权限/403 错误
            if (msg.includes('403') || msg.includes('forbidden') || msg.includes('permission')) {
                throw new Error("AI_PERMISSION_DENIED");
            }
            // 资源不存在/404 错误
            if (msg.includes('404') || msg.includes('not found') || msg.includes('does not exist')) {
                throw new Error("AI_NOT_FOUND");
            }
            // 服务器错误 (500/502/503/504)
            if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') ||
                msg.includes('无可用') || msg.includes('overloaded') || msg.includes('unavailable')) {
                throw new Error("AI_SERVICE_UNAVAILABLE");
            }
            if (msg.includes('invalid json') || msg.includes('parse')) {
                throw new Error("AI_RESPONSE_ERROR");
            }
            if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
                throw new Error("AI_AUTH_ERROR");
            }
        }
        throw new Error("AI_UNKNOWN_ERROR");
    }
}

