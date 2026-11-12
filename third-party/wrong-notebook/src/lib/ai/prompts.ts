/**
 * Shared AI prompt templates
 * This module provides centralized prompt management
 */

/**
 * 将 gradeSemester 字符串转换为年级数字（用于标签过滤）
 * 支持格式：初一/七年级/7年级/小学三年级/高一 等
 * @returns 7-12 或 null（无法识别时）
 */
export function gradeSemesterToGradeNumber(gradeSemester: string): 7 | 8 | 9 | 10 | 11 | 12 | null {
  if (!gradeSemester) return null;
  const gs = gradeSemester.toLowerCase();

  // 小学：primary_3 → 不映射到 7-12，返回 null
  if (gs.startsWith('primary') || gs.includes('小学') || gs.match(/[一二三四五六]年级/)) {
    return null;
  }

  // 初中
  if (gs.includes('初一') || gs.includes('七年级') || gs.includes('7年级') || gs === 'junior_high_1') return 7;
  if (gs.includes('初二') || gs.includes('八年级') || gs.includes('8年级') || gs === 'junior_high_2') return 8;
  if (gs.includes('初三') || gs.includes('九年级') || gs.includes('9年级') || gs === 'junior_high_3') return 9;

  // 高中
  if (gs.includes('高一') || gs.includes('10年级') || gs === 'senior_high_1') return 10;
  if (gs.includes('高二') || gs.includes('11年级') || gs === 'senior_high_2') return 11;
  if (gs.includes('高三') || gs.includes('12年级') || gs === 'senior_high_3') return 12;

  return null;
}

/**
 * 将 gradeSemester 字符串转换为中文年级显示名称
 * 用于注入到 AI 提示词中
 * @returns 中文年级名（如"小学三年级"、"初中二年级"）或 null
 */
export function gradeSemesterToDisplayName(gradeSemester: string): string | null {
  if (!gradeSemester) return null;
  const gs = gradeSemester;

  // 小学
  const primaryMatch = gs.match(/primary[_\s]?(\d)/);
  if (primaryMatch) {
    const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
    return `小学${numMap[primaryMatch[1]] || primaryMatch[1]}年级`;
  }
  if (gs.includes('小学')) {
    // "小学三年级" 格式，直接返回年级部分
    const m = gs.match(/小学([一-龥\d]+年级?)/);
    if (m) return `小学${m[1].replace('年级', '')}年级`.replace('小学小学', '小学');
    return gs.replace(/[上下]$/, '').replace(/[，,].*$/, '').trim();
  }
  if (gs.match(/[一二三四五六]年级/) && !gs.includes('初') && !gs.includes('高')) {
    return `小学${gs.replace(/[上下]$/, '').replace(/[，,].*$/, '').trim()}`;
  }

  // 初中
  const juniorMatch = gs.match(/junior_high[_\s]?(\d)/);
  if (juniorMatch) {
    const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三' };
    return `初中${numMap[juniorMatch[1]] || juniorMatch[1]}年级`;
  }
  if (gs.includes('初一')) return '初中一年级';
  if (gs.includes('初二')) return '初中二年级';
  if (gs.includes('初三')) return '初中三年级';
  if (gs.includes('七年级')) return '初中一年级';
  if (gs.includes('八年级')) return '初中二年级';
  if (gs.includes('九年级')) return '初中三年级';

  // 高中
  const seniorMatch = gs.match(/senior_high[_\s]?(\d)/);
  if (seniorMatch) {
    const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三' };
    return `高中${numMap[seniorMatch[1]] || seniorMatch[1]}年级`;
  }
  if (gs.includes('高一')) return '高中一年级';
  if (gs.includes('高二')) return '高中二年级';
  if (gs.includes('高三')) return '高中三年级';

  return null;
}

/**
 * 生成学历约束指令
 * @param gradeSemester - 年级学期字符串
 * @returns 约束指令字符串，无学历信息时返回空字符串
 */
export function generateGradeInstruction(gradeSemester?: string | null): string {
  if (!gradeSemester) return '';
  const displayName = gradeSemesterToDisplayName(gradeSemester);
  if (!displayName) return '';

  return `\n【学历约束】\n本题目标年级：${displayName}\n请严格使用该年级课程标准范围内的方法解答，禁止使用超纲知识。\n`;
}

/**
 * Options for customizing prompts
 */
export interface PromptOptions {
  providerHints?: string; // Provider-specific instructions
  additionalTags?: {
    subject: string;
    tags: string[];
  }[];
  customTemplate?: string; // Custom template to override default
  // Pre-fetched tags from database (optional, per subject)
  prefetchedMathTags?: string[];
  prefetchedPhysicsTags?: string[];
  prefetchedChemistryTags?: string[];
  prefetchedBiologyTags?: string[];
  prefetchedEnglishTags?: string[];
}

export const DEFAULT_ANALYZE_TEMPLATE = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位世界顶尖的、经验丰富的、专业的跨学科考试分析专家（Interdisciplinary Exam Analysis Expert）。你的核心任务是极致准确地分析用户提供的考试题目图片，全面理解所有文本、图表和隐含约束，并提供一个完整、高度结构化且专业的解决方案。

{{language_instruction}}

【核心输出要求 (OUTPUT REQUIREMENTS)】
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。**严禁**对 LaTeX 公式中的反斜杠进行二次转义（如 "\\frac" 是错误的，必须是 "\frac"）。

请严格按照以下结构输出内容：

<subject>
在此处填写学科，必须是以下之一："数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他"。
</subject>

<knowledge_points>
在此处填写知识点，使用逗号分隔，例如：知识点1, 知识点2, 知识点3
</knowledge_points>

<requires_image>
判断这道题是否需要依赖图片才能正确解答。如果题目包含几何图形、函数图像、实验装置图、电路图等必须看图才能理解的内容，填写 true；如果只需要文字描述即可理解（如英语题、纯文字数学题），填写 false。
</requires_image>

<wrong_answer_text>
如果图片中包含学生已经写出的错误解答、错误步骤、草稿或错误答案，请尽量按原样摘录；如果没有看到学生错误解答，请留空。
</wrong_answer_text>

<mistake_status>
填写以下值之一：wrong_attempt（图片中有错误解答或错误步骤）、not_attempted（没有错误解答，像是完全不会做或未作答）、unknown（无法判断）。
</mistake_status>

<mistake_analysis>
如果图片中包含错误解答，请分析错误可能发生在哪一步、为什么错、导致了什么后果；如果没有错误解答，请留空。
</mistake_analysis>

<grade_semester>
根据题目内容判断它所属的年级与学期，格式为「年级+学期」，例如：初一上、初二下、高一上、高三下。
优先依据题目中明确出现的年级信息（如「八年级」「高二」「高考」「中考」等）；如果没有明确信息，则根据考查的知识范围合理推断。
如果确实无法判断，请留空。
</grade_semester>

<paper_level>
判断这道题通常出现在哪一类试卷中，只能填写以下之一：
- a：A卷/基础题（面向全体学生的基础达标检测）
- b：B卷/提高题（面向中上水平的选拔或拔高）
- other：无法判断或其他
</paper_level>

<question_text>
在此处填写题目的完整文本。使用 Markdown 格式。所有数学公式使用 LaTeX 符号（行内 $...$，块级 $$...$$）。

【表格处理规则】
如果图片中包含表格，必须完整转录表格内容，遵循以下原则：

1. **标准表格**：使用 Markdown 表格语法
   | 列标题1 | 列标题2 | 列标题3 |
   |---------|---------|---------|
   | 数据1   | 数据2   | 数据3   |

2. **复杂表格**（合并单元格/多级表头/不规则布局）：
   - 优先尝试用 Markdown 表格近似表示
   - 如果 Markdown 无法准确表达，在表格前用文字说明结构，然后用简化的 Markdown 表格 + 注释
   - 示例：
     > 注：第1行为主标题，横跨3列；第2-3行为数据行

     | 项目 | 数值A | 数值B |
     |------|-------|-------|
     | 测试1 | 10 | 20 |
     | 测试2 | 15 | 25 |

3. **表格完整性要求**：
   - ★ 表格的**每一行必须单独占一行**（表头一行、分隔行一行、每条数据各一行）。
     禁止把整张表写在同一行里 —— 压成一行就不再是表格，前端只能把竖线原样印给学生。
   - 必须转录所有单元格内容（包括空单元格用 - 或空格表示）
   - 保留表格标题、单位、注释
   - 保留数据的对齐关系和分组信息
   - 表格中的数学公式使用 LaTeX 语法

4. **表格上下文**：
   - 如果表格有标题或编号（如"表1"），保留在表格前
   - 如果表格后有注释或说明，保留在表格后
   - 保持表格在题目中的位置关系

5. **特殊情况处理**：
   - 图表混合：如果表格旁边有图形，用文字说明位置关系
   - 手写表格：尽力识别手写内容，不确定的用 [?] 标注
   - 模糊表格：如果表格不清晰，在表格前注明"（表格内容可能不完整）"
</question_text>

<answer_text>
在此处填写正确答案。使用 Markdown 和 LaTeX 符号。如果答案包含表格，遵循上述【表格处理规则】。
</answer_text>

<analysis>
在此处填写详细的步骤解析。
* 必须使用简体中文。
* **直接使用标准的 LaTeX 符号**（如 $\frac{1}{2}$），**不要**进行 JSON 转义（不要写成 \\frac）。
* 如果解析过程需要表格（如列表对比、分步计算表），遵循上述【表格处理规则】。
</analysis>

【知识点标签列表（KNOWLEDGE POINT LIST）】
{{knowledge_points_list}}

【标签使用规则 (TAG RULES)】
- 标签必须与题目实际考查的知识点精准匹配。
- 每题最多 5 个标签。

【!!! 关键格式与内容约束 (CRITICAL RULES) !!!】
1. **格式严格**：必须严格包含上述 11 个 XML 标签，除此之外不要输出任何其他“开场白”或“结束语”。
2. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。
3. **内容完整**：如果包含子问题，请在 question_text 中完整列出。
4. **禁止图片**：严禁包含任何图片链接或 markdown 图片语法。

{{grade_instruction}}
{{provider_hints}}`;

export const DEFAULT_SIMILAR_TEMPLATE = `你是一位资深的K12教育题目生成专家，具备跨学科的题目创作能力。你的核心任务是**根据以下原题和知识点，举一反三生成高质量教学题目**，帮助学生巩固知识并拓展解题思路。
### 角色定义
1. **学科全能专家**  
   - 精通K12阶段所有学科（数学/语文/英语/物理/化学/生物/历史/地理/政治）
   - 熟悉各年级课程标准与知识点分布
   - 能准确识别题目考察的核心能力点（计算/推理/分析/应用/创新）
2. **题目变异大师**  
   - 掌握12种变式技法：条件替换/情境迁移/问题转化/数据重构/图形变形/角色反转/跨学科融合/难度阶梯/开放拓展/陷阱设计/逆向思维/生活应用
   - 确保变式题目保持原题核心考点，改变题目表现形式
3. **学情分析师**  
   - 预判学生易错点（认知盲区/概念混淆/计算失误/审题偏差）
   - 在变式题目中针对性强化易错点训练
### 执行流程
1. **接收任务**  
	原题: "{{original_question}}"
	{{language_instruction}}
	DIFFICULTY LEVEL: {{difficulty_level}}
	{{difficulty_instruction}}
	Knowledge Points: {{knowledge_points}}  
2. **解构分析**  
   - 提取核心考点与能力要求
   - 分析题目陷阱与解题路径
3.  **质量管控**  
   - 确保每道题：  
     ✓ 覆盖相同核心知识点  
     ✓ 保持解题逻辑一致性  
     ✓ 答案唯一且可验证  
     ✓ 无知识性错误
### 输出规范
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。**严禁**返回 \`\`\`json ... \`\`\`。

请严格按照以下结构输出内容（不要包含任何其他文字）：

<question_text>
在此处填写新生成的题目文本。包含选项（如果是选择题）。
</question_text>

<answer_text>
在此处填写新题目的正确答案。
* ★★ **每个空只写「最终答案」，不要写算式和推导过程。**
  - 对：「130元」　　错：「260-130=130（元），最高的一天比最低的一天多130元」
  - 对：「800元」　　错：「大约：200+200+300+100=800（元）」
  - 算式、比较、说明一律写进 <analysis>，<answer_text> 里只留学生该填的那个值。
* ★ 一道题有几个空，就按「(1) xxx；(2) yyy；(3) zzz」编号写几条，**条数必须等于空数**。
* ★ 数值答案带上单位（如「130元」「25米」），学生只填数字或只填带单位的都算对。
* ★ 描述性答案写**最短的可判形式**（如「3日；4日」），不要写成完整句子。
</answer_text>

<analysis>
在此处填写新题目的详细解析。
* 必须使用简体中文。
* **直接使用标准的 LaTeX 符号**（如 $\frac{1}{2}$），**不要**进行 JSON 转义。
</analysis>

<figure>
{{figure_instruction}}
</figure>

###关键格式与内容约束 (CRITICAL RULES) !!!
1. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。

{{grade_instruction}}
{{provider_hints}}`;

/**
 * Helper to replace placeholders in template
 */
function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || "";
  });
}

/**
 * 获取指定年级的累进数学标签
 * 初一(7)：只包含七年级标签
 * 初二(8)：包含七年级+八年级标签
 * 初三(9)：包含七年级+八年级+九年级标签
 * 高一(10)：只包含高一标签（不含初中）
 * 高二(11)：包含高一+高二标签
 * 高三(12)：包含高一+高二+高三标签
 * @param grade - 年级 (7-9:初中, 10-12:高中) 或 null
 * @returns 标签数组
 */
/**
 * 获取指定年级的数学标签
 * 必须由调用方预先从数据库获取标签并通过 prefetchedTags 传入
 * @param grade - 年级（已弃用，保留接口兼容）
 * @param prefetchedTags - 从数据库预获取的标签数组
 * @returns 标签数组
 */
export function getMathTagsForGrade(
  grade: 7 | 8 | 9 | 10 | 11 | 12 | null,
  prefetchedTags?: string[]
): string[] {
  // 必须使用预获取的数据库标签
  if (prefetchedTags && prefetchedTags.length > 0) {
    return prefetchedTags;
  }

  // 如果没有预获取标签，返回空数组（AI 将自由标注）
  console.warn('[prompts] No prefetched tags provided, AI will tag freely');
  return [];
}

/**
 * Generates the analyze image prompt
 * @param language - Target language for analysis ('zh' or 'en')
 * @param grade - Optional grade level (7-9:初中, 10-12:高中) for cumulative tag filtering
 * @param options - Optional customizations
 */
export function generateAnalyzePrompt(
  language: 'zh' | 'en',
  grade?: 7 | 8 | 9 | 10 | 11 | 12 | null,
  subject?: string | null,
  options?: PromptOptions,
  gradeSemester?: string | null
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English. If the original question is in English, the new 'questionText' and 'answerText' MUST be in English, but the 'analysis' MUST be in Simplified Chinese (to help the student understand). "
    : "Please ensure all text fields are in English.";

  // 获取各学科标签（优先使用预获取的数据库标签）
  const mathTags = getMathTagsForGrade(grade || null, options?.prefetchedMathTags);
  const mathTagsString = mathTags.length > 0 ? mathTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const physicsTags = options?.prefetchedPhysicsTags || [];
  const physicsTagsString = physicsTags.length > 0 ? physicsTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const chemistryTags = options?.prefetchedChemistryTags || [];
  const chemistryTagsString = chemistryTags.length > 0 ? chemistryTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const biologyTags = options?.prefetchedBiologyTags || [];
  const biologyTagsString = biologyTags.length > 0 ? biologyTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const englishTags = options?.prefetchedEnglishTags || [];
  const englishTagsString = englishTags.length > 0 ? englishTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  // 根据科目决定显示哪些标签（节省 token，提高准确性）
  let tagsSection = "";

  if (subject === '数学') {
    tagsSection = `**数学标签 (Math Tags):**
使用人教版课程大纲中的**精确标签名称**，可选标签如下：
${mathTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '物理') {
    tagsSection = `**物理标签 (Physics Tags):**
使用课程大纲中的**精确标签名称**，可选标签如下：
${physicsTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '化学') {
    tagsSection = `**化学标签 (Chemistry Tags):**
使用课程大纲中的**精确标签名称**，可选标签如下：
${chemistryTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '生物') {
    tagsSection = `**生物标签 (Biology Tags):**
使用课程大纲中的**精确标签名称**，可选标签如下：
${biologyTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '英语') {
    tagsSection = `**英语标签 (English Tags):**
使用课程大纲中的**精确标签名称**，可选标签如下：
${englishTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else {
    // 未知科目：显示所有标签让 AI 判断
    tagsSection = `**数学标签 (Math Tags):**
${mathTagsString}

**物理标签 (Physics Tags):**
${physicsTagsString}

**化学标签 (Chemistry Tags):**
${chemistryTagsString}

**生物标签 (Biology Tags):**
${biologyTagsString}

**英语标签 (English Tags):**
${englishTagsString}`;
  }

  const template = options?.customTemplate || DEFAULT_ANALYZE_TEMPLATE;

  return replaceVariables(template, {
    language_instruction: langInstruction,
    knowledge_points_list: tagsSection,
    grade_instruction: generateGradeInstruction(gradeSemester),
    provider_hints: options?.providerHints || ''
  }).trim();
}

/**
 * Generates the "similar question" prompt
 * @param language - Target language ('zh' or 'en')
 * @param originalQuestion - The original question text
 * @param knowledgePoints - Knowledge points to test
 * @param difficulty - Difficulty level
 * @param options - Optional customizations
 */
export function generateSimilarQuestionPrompt(
  language: 'zh' | 'en',
  originalQuestion: string,
  knowledgePoints: string[],
  difficulty: 'easy' | 'medium' | 'hard' | 'harder' = 'medium',
  options?: PromptOptions,
  gradeSemester?: string | null,
  // 2026-10-19：原题是否依赖图形（由分析阶段的 requires_image 得来），以及原题图是否真的随请求一起喂给了模型。
  figureHint?: { requiresImage?: boolean; hasImage?: boolean }
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: Provide the output based on the 'Original Question' language. If the original question is in English, the new 'questionText' and 'answerText' MUST be in English, but the 'analysis' MUST be in Simplified Chinese (to help the student understand). If the original is in Chinese, everything MUST be in Simplified Chinese."
    : "Please ensure the generated question is in English.";

  const difficultyInstruction = {
    'easy': "Make the new question EASIER than the original. Use simpler numbers and more direct concepts.",
    'medium': "Keep the difficulty SIMILAR to the original question.",
    'hard': "Make the new question HARDER than the original. Combine multiple concepts or use more complex numbers.",
    'harder': "Make the new question MUCH HARDER (Challenge Level). Require deeper understanding and multi-step reasoning."
  }[difficulty];

  const template = options?.customTemplate || DEFAULT_SIMILAR_TEMPLATE;

  // ★ 配图指令（2026-10-19，user 报障「举一反三的题目并没有图片」）：
  //   原题靠图才能做（几何/函数图像/电路/实验装置），变式题只给文字 ⇒ 学生做不了、
  //   也谈不上"举一反三"。所以凡是这类题，模型必须连图一起生成。
  //   用内联 SVG 而不是外链：可随题目落库、前端直渲、无外链失效与版权问题。
  const needsFigure = !!figureHint?.requiresImage;
  const sawImage = !!figureHint?.hasImage;
  const figureInstruction = needsFigure
    ? [
        '这道**原题依赖图形**才能作答（几何图形 / 函数图像 / 电路图 / 实验装置 / 统计图等），',
        '所以新题**必须**带一张同类型的新图，否则学生无法作答。',
        sawImage ? '（原题图片已随本次请求一并提供，请先看清它的图形结构与标注方式。）' : '',
        '',
        '输出要求：',
        '1. 只输出一个内联 SVG 片段，以 `<svg` 开头、`</svg>` 结尾，**不要**任何外链图片、不要 markdown 图片语法、不要 base64。',
        '2. `<svg>` 必须带 `viewBox`（如 `viewBox="0 0 320 200"`）、`xmlns="http://www.w3.org/2000/svg"`，不要写死 width/height。',
        '3. 图形内容必须与**新题的条件**一致（数字、角度、标签、点字母都要对应新题，不要照抄原题的数字）。',
        '4. 只允许这些元素与属性：`svg, g, path, line, polyline, polygon, rect, circle, ellipse, text, tspan, defs, marker` 及 `d, x, y, x1, y1, x2, y2, cx, cy, r, rx, ry, width, height, points, fill, stroke, stroke-width, stroke-dasharray, font-size, font-family, text-anchor, dominant-baseline, transform, viewBox, xmlns, id, marker-end, marker-start, opacity`。**禁止** `<script>`、`<foreignObject>`、`on*` 事件属性、`<image>`、外部 `href`。',
        '5. 线条用 `stroke`、文字用 `<text>`；不要用 emoji 代替标注。',
        '6. 如果新题确实不需要图（例如你把它改成了纯文字题），就把这一整段留空（`<figure>` 与 `</figure>` 之间什么都不要写）。',
      ].join('\n')
    : '这道题不需要图（纯文字即可作答）⇒ `<figure>` 与 `</figure>` 之间**留空**，不要输出任何内容。若你判断新题确实需要一张图才能作答，也可以按 SVG 规则补一张。';

  return replaceVariables(template, {
    difficulty_level: difficulty.toUpperCase(),
    difficulty_instruction: difficultyInstruction,
    language_instruction: langInstruction,
    original_question: originalQuestion.replace(/"/g, '\\"').replace(/\n/g, '\\n'), // Escape for template safety
    knowledge_points: knowledgePoints.join(", "),
    grade_instruction: generateGradeInstruction(gradeSemester),
    provider_hints: options?.providerHints || '',
    figure_instruction: figureInstruction
  }).trim();
}

/**
 * 重新解题提示词模板
 * 用于根据校正后的题目文本重新生成答案和解析
 */
export const DEFAULT_REANSWER_TEMPLATE = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位经验丰富的专业教师。用户已经提供了一道**校正后的题目文本**，请你为这道题目提供正确的答案和详细的解析。

{{language_instruction}}

【题目内容 (QUESTION)】
{{question_text}}

【学科提示 (SUBJECT HINT)】
{{subject_hint}}

【核心输出要求 (OUTPUT REQUIREMENTS)】
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。

请严格按照以下结构输出内容（不要包含任何其他文字）：

<answer_text>
在此处填写正确答案。使用 Markdown 和 LaTeX 符号。
</answer_text>

<analysis>
在此处填写详细的步骤解析。
* 必须使用简体中文。
* **直接使用标准的 LaTeX 符号**（如 $\\frac{1}{2}$），**不要**进行 JSON 转义。
* 解析要清晰、完整，适合学生理解。
</analysis>

<knowledge_points>
在此处填写知识点，使用逗号分隔，例如：知识点1, 知识点2, 知识点3
</knowledge_points>

<wrong_answer_text>
请只根据校正后的题目文本和当前图片中可见的学生作答痕迹重新判断学生错误解答。如果当前图片中可见错误解答、错误步骤、草稿或错误答案，请尽量按原样摘录；如果看不到学生作答痕迹，请留空，不要猜测。
</wrong_answer_text>

<mistake_status>
重新判断并填写以下值之一：wrong_attempt（当前题目文本或当前图片中明确有错误解答或错误步骤）、not_attempted（当前图片明确显示未作答或空白）、unknown（看不到学生作答痕迹或无法判断）。不要猜测。
</mistake_status>

<mistake_analysis>
请基于校正后的题目和当前图片中可见的学生作答痕迹重新判断错因。如果有可见错误解答，请分析错误可能发生在哪一步、为什么错、导致了什么后果；如果看不到学生作答痕迹或无法判断，请留空，不要猜测。
</mistake_analysis>

<grade_semester>
根据题目内容判断它所属的年级与学期，格式为「年级+学期」，例如：初一上、初二下、高一上、高三下。
优先依据题目中明确出现的年级信息（如「八年级」「高二」「高考」「中考」等）；如果没有明确信息，则根据考查的知识范围合理推断。
如果确实无法判断，请留空。
</grade_semester>

<paper_level>
判断这道题通常出现在哪一类试卷中，只能填写以下之一：
- a：A卷/基础题（面向全体学生的基础达标检测）
- b：B卷/提高题（面向中上水平的选拔或拔高）
- other：无法判断或其他
</paper_level>

【!!! 关键格式与内容约束 (CRITICAL RULES) !!!】
1. **格式严格**：必须严格包含上述 8 个 XML 标签，不要输出其他内容。
2. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。
3. **题目不变**：不要修改或重复题目内容，只提供答案和解析。

{{grade_instruction}}
{{provider_hints}}`;

/**
 * GeoGebra 动态演示生成提示词
 * 用于判断题目是否可以用 GeoGebra 演示，以及生成对应的 GeoGebra 命令
 */
export const DEFAULT_GEOGEBRA_PROMPT = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位专业的 GeoGebra 数学可视化专家。你的任务是分析一道数学题目，判断它是否适合用 GeoGebra 进行动态可视化演示。如果适合，生成可以直接在 GeoGebra 中执行的命令。

【题目内容 (QUESTION)】
{{question_text}}

【答案内容 (ANSWER)】
{{answer_text}}

【解析内容 (ANALYSIS)】
{{analysis}}

{{error_feedback}}

【判断标准 (SUITABILITY CRITERIA)】
适合用 GeoGebra 演示的题目类型：
1. **函数与图像**：一次函数、二次函数、反比例函数、指数函数、对数函数、三角函数等
2. **几何图形**：三角形、四边形、圆、直线关系（平行、垂直）、角度
3. **解析几何**：直线方程、圆的方程、椭圆、双曲线、抛物线
4. **向量**：向量运算、向量的几何表示
5. **概率统计**：数据分布图、正态分布曲线
6. **不等式**：线性规划、可行域
7. **立体几何**（部分可演示）：截面、展开图

不适合用 GeoGebra 演示的题目类型：
1. 纯文字推理题、证明题（无图形元素）
2. 纯计算题（如解方程、化简表达式）
3. 概念辨析题、选择题（无几何内容）
4. 英语、语文、历史等非理科题目
5. 概率计算（无图形意义的）
6. 数列通项公式推导（无图形意义的）

【GeoGebra 命令规范 (COMMAND SYNTAX)】
如果适合演示，生成 GeoGebra 命令数组。每条命令一行，支持以下类型：

**GeoGebra 绘图命令（通过 evalCommand 执行）：**
- 函数：f(x) = x^2
- 点：A = (1, 2)
- 直线：line: y = 2x + 1  或  Line(A, B)
- 线段：Segment(A, B)
- 圆：Circle(A, 3)  或  c: (x-1)^2 + (y-2)^2 = 9
- 椭圆：Ellipse(F1, F2, 5)
- 多边形：Polygon(A, B, C)
- 交点：Intersect(f, g, 1)  或  Intersect(f, g, x1, x2)
- 中点：Midpoint(A, B)
- 垂线：PerpendicularLine(P, l)
- 平行线：ParallelLine(P, l)
- 角度：Angle(A, B, C)
- 文本：Text("说明文字", (x, y))
- 滑动条：a = Slider(-5, 5, 0.1)
- 轨迹：Locus(P, Q)
- 反射：Reflect(A, l)
- 平移：Translate(A, v)
- 旋转：Rotate(A, angle, center)

**Applet API 设置命令（通过 applet 方法直接调用）：**
- setCoordSystem(-10, 10, -10, 10)  -- 设置坐标范围
- setAxesVisible(true, true)  -- 显示/隐藏坐标轴
- setGridVisible(true)  -- 显示/隐藏网格
- setColor("对象名", R, G, B)  -- 设置颜色 (0-255)
- setLineThickness("对象名", 3)  -- 设置线宽
- setLineStyle("对象名", 1)  -- 0=实线, 1=虚线
- setPointSize("对象名", 5)  -- 设置点大小
- setPointStyle("对象名", 4)  -- 点样式 (3-8)
- setLabelVisible("对象名", true)  -- 显示/隐藏标签
- setCaption("对象名", "LaTeX标签")  -- 设置标签文本
- setFilling("对象名", 0.3)  -- 设置填充透明度 (0-1)

【输出格式 (OUTPUT FORMAT)】
你的响应必须**只有以下 JSON 格式**，不要包含其他任何文字：

如果题目**适合**用 GeoGebra 演示：
{"suitable": true, "commands": ["命令1", "命令2", "命令3", ...], "description": "简要说明演示内容"}

如果题目**不适合**用 GeoGebra 演示：
{"suitable": false, "commands": [], "description": "不适合原因简述"}

【!!! 关键约束 (CRITICAL RULES) !!!】
1. 输出必须是合法的 JSON，不要添加 markdown 代码块标记
2. commands 数组中的每条命令必须是 GeoGebra 可直接执行的语法
3. setCoordSystem 应根据题目内容合理设置坐标范围
4. 所有图形对象应设置合适的颜色和样式以便于观察
5. 确保坐标范围能让所有关键图形和交点清晰可见
6. description 用简体中文
7. 如果题目涉及参数讨论（如讨论 a 的取值范围），用滑动条 (Slider) 展示参数变化效果
8. 对于函数题，应画出函数图像并标注关键点（交点、顶点、渐近线等）
9. 【!!! 命令语法检查 (COMMAND SYNTAX CHECK) !!!】在生成命令后，必须逐条检查以下内容：
   a. 每个变量在使用前必须已被定义（例如如果使用 F = Intersect(f, g)，则 f 和 g 必须在之前已定义）
   b. 所有命令名称必须是 GeoGebra 官方支持的指令（如平行线用 Line(P, l) 而非 ParallelLine(P, l)）
   c. 命令顺序必须合理：先定义基础对象（点、线、函数），再定义派生对象（交点、轨迹、变换）
   d. 每个命令的语法必须正确（参数数量、类型、顺序与 GeoGebra 官方文档一致）
   e. 如果使用了循环或条件语句，确保语法正确
   f. 坐标轴范围 (setCoordSystem) 必须在所有绘图命令之前设置`;

/**
 * 生成 GeoGebra 分析提示词
 */
export function generateGeogebraPrompt(
    questionText: string,
    answerText: string,
    analysis: string,
    previousErrors?: string
): string {
    let prompt = DEFAULT_GEOGEBRA_PROMPT.replace(
        "{{question_text}}",
        questionText
    )
        .replace("{{answer_text}}", answerText)
        .replace("{{analysis}}", analysis);

    if (previousErrors?.trim()) {
        prompt = prompt.replace(
            "{{error_feedback}}",
            `【上次执行错误 (PREVIOUS ERRORS)】\n上次生成的 GeoGebra 命令执行时出现了以下错误，请分析错误原因并在这次生成中修正：\n${previousErrors}\n\n【错误修正要求 (ERROR FIX RULES)】\n请严格按以下步骤修正：\n1. 检查每条失败命令，确认是语法错误、变量未定义还是命令名称错误\n2. 如果是"未定义变量X"，在命令之前添加定义该变量的命令，或调整命令顺序\n3. 如果是"未知的指令"，替换为 GeoGebra 官方支持的等效命令（如 Line(P, l) 替代 ParallelLine(P, l)）\n4. 重新排列所有命令的顺序，确保每个对象在使用前已定义\n5. 生成后再次逐条检查：每条命令的语法、变量引用、依赖关系是否正确`
        );
    } else {
        prompt = prompt.replace("{{error_feedback}}", "");
    }

    return prompt;
}

/**
 * 生成重新解题提示词
 * @param language - 语言 ('zh' 或 'en')
 * @param questionText - 校正后的题目文本
 * @param subject - 学科提示（可选）
 * @param options - 自定义选项
 */
export function generateReanswerPrompt(
  language: 'zh' | 'en',
  questionText: string,
  subject?: string | null,
  options?: PromptOptions,
  gradeSemester?: string | null
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: 解析必须使用简体中文。如果题目是英文，答案保持英文，但解析用中文。"
    : "Please ensure all text fields are in English.";

  const subjectHint = subject
    ? `本题学科：${subject}`
    : "请根据题目内容判断学科。";

  const template = options?.customTemplate || DEFAULT_REANSWER_TEMPLATE;

  return replaceVariables(template, {
    language_instruction: langInstruction,
    question_text: questionText,
    subject_hint: subjectHint,
    grade_instruction: generateGradeInstruction(gradeSemester),
    provider_hints: options?.providerHints || ''
  }).trim();
}

// ─────────────────────────────────────────────────────────────────────────
// 「拍整张卷子」：一次认一整页，只挑错题与空白题，★ 一个答案都不许输出
// ─────────────────────────────────────────────────────────────────────────
/**
 * 与 generateAnalyzePrompt 的区别（别合并，两条链路的目标正好相反）：
 *   · 单题拍照：学生拍一道题，我们要把**答案和解析**算出来给他校对 —— 那是"帮他学"；
 *   · 整卷识别：学生拍一张卷子，我们只要"哪几道要进错题本"，**绝不能**把答案吐出来 ——
 *     否则他下次直接拍整张卷子抄。所以这里的第一条硬规定是"不许写答案"。
 *
 * ★★★ 为什么"不许写答案"要写成三条不同的说法（禁止 + 字段白名单 + 错因枚举）：
 *   只写一句"不要输出正确答案"，模型仍会在 reason 里写「应为 x=8」「先移项再合并」——
 *   那是它最自然的表达方式，实测同类提示词里这类"顺手解释"是最难禁掉的一类泄漏。
 *   所以错因只许从**固定枚举**里选一个词，它在结构上就没有写数字/式子的位置。
 *
 * ★★ 老师批改痕迹优先（用户拍板"两者结合"）：
 *   卷面上有红叉/扣分/半勾 = 老师已经判过错，以老师为准（老师看到的是完整过程，
 *   而模型只看到一张可能模糊的照片）；卷面干干净净没批过，才让模型自己判，
 *   并且前端会把这批题标成「AI 判断，可能有误」—— 两种来源在 UI 上必须能分清。
 */
const PAPER_HINT_ZH = [
    '你在帮一个学生把**整张试卷/练习卷**上的错题和空题整理进错题本。',
    '请完成四件事：① 认出这一页上的每一道题（题号 + 题干 + 选项）；② 照抄学生**手写**的作答；',
    '③ 判断这道题要不要进错题本；④ 给出知识点标签。',
    '',
    '★★★ 第一条硬规定：**任何字段都不许出现答案**。',
    '  · 你可以在**心里**把题做一遍来判断对错，但**绝对不要**把正确答案、计算结果、解题步骤、',
    '    「应为…」「答案是…」「先…再…」这类话写进任何一个字段里。',
    '  · 输出里出现任何一个数字结果、式子结果或解题过程，都算错误输出。',
    '  · 错因只许从下面 7 个词里挑一个，**不许自己造句**：',
    '    计算错误 / 概念不清 / 审题不清 / 方法不会 / 格式单位 / 未作答 / 其他',
    '',
    '输出要求：',
    '- 只输出**一个 JSON 对象**，不要解释、不要 markdown 代码块、不要前后缀。',
    '- 结构如下（**只许出现这些字段名**）：',
    '{"subject":"数学","title":"第四单元测评","gradeSemester":"初二上","paperLevel":"a",',
    ' "items":[{"no":"3","section":"一、选择题","questionText":"题干原文","options":["2x+1","x-3"],',
    ' "studentAnswer":"B","teacherMark":"wrong","modelVerdict":"wrong","errorTag":"计算错误",',
    ' "knowledgePoints":["一元一次方程"]}]}',
    '',
    '字段口径：',
    '  · no：卷面题号原样抄（"1"、"2(1)"、"三、5" 都行），同一页里必须唯一。',
    '  · section：这道题所属的**大题号**或大题名（「一、选择题」「填空题」这类卷面原样文字）。',
    '    卷面从头连续编号时写空串 ""；**分大题重新编号时（选择题 1~5、填空题又从 1 开始）必须写**，',
    '    否则两道题会被当成同一题。',
    '  · questionText：**题干原文，逐字照抄**。含条件、括号、下划线空位、单位、问句、小问序号。',
    '    只允许去掉学生手写的作答；不许概括、缩写、改写、补全或纠错，不许截断。',
    '    看不清的字用「?」保留位置。题干跨行时合并成一段（保留原标点）。',
    '  · options：这道题是选择题时，把 A/B/C/D 各选项的**内容**逐条抄进来（纸面顺序，不要带「A.」前缀）。',
    '    不是选择题就写 []。',
    '  · studentAnswer：学生**手写**的作答原文；没写就写空串 ""（空题也必须进 items，不要省略）。',
    '    ★ 印在纸上的题目、选项、答案**不是**学生的作答，绝不要当成他写的。',
    '  · teacherMark：卷面上**老师的批改痕迹**，三选一：',
    '      "wrong" = 有红叉/✗/斜线划掉/红笔扣分（如 -2）/半勾/圈出错处；',
    '      "right" = 有红勾/√/「对」/满分标记；',
    '      "none"  = 卷面没有批改痕迹（没批过的练习卷、自己做的卷子）。',
    '    ★ 只认**老师笔迹**（通常是红笔、与作答明显不同色）；学生自己的笔迹不算批改痕迹。',
    '  · modelVerdict：你自己判断的结果，三选一："right" / "wrong" / "blank"。',
    '    学生完全没作答 ⇒ 一律 "blank"（不用管对不对）。',
    '  · errorTag / knowledgePoints：错因标签（只从上面 7 个词里选）与知识点（1~3 个，用课本里的说法）。',
    '    teacherMark 是 "right" 的题不收录，可以不写这两个字段。',
    '',
    '收录口径（★ 决定哪道题进错题本，按这个顺序想）：',
    '  1. 学生完全没作答 ⇒ 收录（空题）。',
    '  2. 老师批了错（teacherMark="wrong"）⇒ 收录，**以老师为准**，就算你觉得学生写对了也照样收录。',
    '  3. 老师批了对（teacherMark="right"）⇒ **不收录**。',
    '  4. 卷面没有批改痕迹（teacherMark="none"）⇒ 按你自己的 modelVerdict：wrong 才收录。',
    '  ★ 只输出**要收录**的题（错题 + 空题）。判对了的题、以及卷头卷尾那些不是题的行，一律不要出现在 items 里。',
    '',
    '其它：',
    '- 卷头的标题、姓名/班级/考号那一行、「满分 xx 分」、页码、页脚网址**都不是题**，不要写进 items。',
    '- 题目被翻页截断时，只抄本页能看见的部分，不要猜下一页的内容。',
    '- 整页没有一道题能认出来（拍糊了、拍到手或桌面）⇒ 输出 {"empty":true}。',
    '- 公式用常见文本写法（3/4、x^2、√2、≤）。',
    '- 除 no/section/questionText/options/studentAnswer/teacherMark/modelVerdict/errorTag/knowledgePoints 之外的字段，一个都不要输出。',
].join('\n');

const PAPER_HINT_EN = [
    'You are helping a student file the WRONG and BLANK questions of a whole exam paper into a mistake notebook.',
    'Do four things: (1) find every question on this page (number + stem + options); (2) transcribe the student\'s HANDWRITTEN answer;',
    '(3) decide whether it must be filed; (4) give knowledge-point tags.',
    '',
    '★★★ Hard rule #1: NEVER output the answer in any field.',
    '  You may work the problem out silently to judge correctness, but do NOT write the correct answer, the computed result,',
    '  the solution steps, or sentences like "should be 8" / "the answer is" into ANY field.',
    '  · errorTag must be one of these exact words: 计算错误 / 概念不清 / 审题不清 / 方法不会 / 格式单位 / 未作答 / 其他',
    '',
    'Output: ONE JSON object, no prose, no markdown fence, only these keys:',
    '{"subject":"数学","title":"Unit 4 Test","gradeSemester":"","paperLevel":"a","items":[{"no":"3","section":"","questionText":"...","options":[],"studentAnswer":"B","teacherMark":"wrong","modelVerdict":"wrong","errorTag":"计算错误","knowledgePoints":["..."]}]}',
    '',
    'Field rules:',
    '  · questionText: verbatim transcript of the printed stem. Do not summarise, shorten or correct. Use "?" for illegible chars.',
    '  · options: option CONTENTS without the "A." prefix; [] if not multiple-choice.',
    '  · studentAnswer: verbatim handwritten answer; empty string if the student left it blank (blank questions MUST still be listed).',
    '  · teacherMark: "wrong" (red X / cross / deducted marks / half tick) | "right" (tick / correct mark) | "none" (paper not graded).',
    '    Only the TEACHER\'s pen marks count, never the student\'s own writing.',
    '  · modelVerdict: "right" / "wrong" / "blank" (blank means the student wrote nothing).',
    '',
    'Filing rules: blank => file; teacherMark "wrong" => file (teacher wins); teacherMark "right" => skip;',
    'teacherMark "none" => file only if your modelVerdict is "wrong".',
    'Only list questions that must be filed. Never include the page header, name/class line, "full marks" line, page number or footer.',
    'If the page has no readable question at all, output {"empty":true}.',
].join('\n');

/**
 * 生成整卷识别提示词。
 * ★ 不接 customTemplate：单题链路那边允许用户覆盖提示词（`config.prompts.analyze`），
 *   但这条链路的"不许给答案"是产品红线 —— 一旦可被线上配置覆盖，等于给抄作业开了个开关。
 */
export function generatePaperPrompt(
  language: 'zh' | 'en',
  options?: {
    gradeSemester?: string | null;
    subject?: string | null;
    teacherMarks?: boolean;
  }
): string {
  const base = language === 'zh' ? PAPER_HINT_ZH : PAPER_HINT_EN;
  const parts: string[] = [base];

  const grade = options?.gradeSemester ? generateGradeInstruction(options.gradeSemester) : '';
  if (grade) parts.push('', grade);

  if (options?.subject) {
    parts.push('', language === 'zh' ? `本卷学科：${options.subject}` : `Subject: ${options.subject}`);
  }

  // ★ 学生自己做的卷子（没有老师批改）也照样支持，但要把"以谁为准"说清楚，
  //   否则模型会看到"没有红叉"就当全对，一道题都不收。
  if (options?.teacherMarks === false) {
    parts.push(
      '',
      language === 'zh'
        ? '注意：这份卷子看起来**没有老师批改痕迹**，请按你自己的判断（modelVerdict）决定收录哪些题，teacherMark 一律写 "none"。'
        : 'Note: this paper has no teacher marks; decide by your own verdict and always set teacherMark to "none".'
    );
  }

  return parts.filter(Boolean).join('\n').trim();
}
