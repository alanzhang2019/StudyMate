/**
 * 「拍整张卷子」的纯规则层（不依赖框架、不依赖模型）
 * ============================================================
 * 为什么单独抽一个 .mjs 而不是写在 provider 里：
 *   这条链路最要命的一条要求是「**答案物理上不可能外泄**」。
 *   提示词只能"请求"模型别写答案，真正兜底的是这里的**白名单重建** ——
 *   模型返回什么字段都无所谓，我们只按名字挑出允许的 9 个字段重新拼对象。
 *   把它抽成纯函数，就能在 `scripts/check-paper-scan.cjs` 里直接喂一份
 *   「故意塞了 correctAnswer / analysis / solution」的脏数据，断言它们一个字都出不来。
 *   （写死在 provider 里的话，只能靠 grep 源码，那种判据形同虚设。）
 *
 * ★★★ 铁律：这个文件里**不许**新增任何携带答案的字段。
 *   要加字段先想清楚：拍卷子不能给答案，否则学生拍一整张卷子抄。
 */

/** 错因只许这 7 个词。任何一个不在表里的字符串都会被压成「其他」—— */
/** 这也是防泄漏的一道结构闸：模型想写「应为 x=8」，落库时会变成「其他」。 */
export const ERROR_TAGS = ['计算错误', '概念不清', '审题不清', '方法不会', '格式单位', '未作答', '其他'];

/** 允许出现在返回体里的字段（多一个都不行）。 */
export const PAPER_ITEM_FIELDS = [
    'no', 'section', 'questionText', 'options', 'studentAnswer',
    'verdict', 'evidence', 'errorTag', 'knowledgePoints', 'pageNo',
];

const MAX_Q = 4000;      // 题干上限：防模型把整页文字塞进一道题
const MAX_OPT = 8;       // 选项条数上限
const MAX_OPT_LEN = 300;
const MAX_TAGS = 3;
const MAX_TAG_LEN = 24;

function str(v) {
    return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim());
}

function clip(s, n) {
    const t = str(s);
    return t.length > n ? t.slice(0, n) : t;
}

/**
 * 判定这道题要不要进错题本，以及"这个判定是谁给的"。
 *
 * 顺序就是用户拍板的口径（两者结合、老师优先）：
 *   1. 学生完全没作答 → 空题，必收（不管老师批没批、判没判）
 *   2. 老师批了错 → 收，以老师为准（就算模型觉得学生写对了也收）
 *   3. 老师批了对 → 不收
 *   4. 卷面没批改痕迹 → 按模型自己的判断：判错才收
 *
 * @returns {{verdict:'wrong'|'blank', evidence:'teacher'|'blank'|'model'} | null} null = 不收录
 */
export function decideFiling(raw) {
    const studentAnswer = str(raw && raw.studentAnswer);
    const teacherMark = str(raw && raw.teacherMark).toLowerCase();
    const modelVerdict = str(raw && raw.modelVerdict).toLowerCase();

    // 1. 空题优先 —— 也算"错题"，但它跟"做错了"在 UI 上是两个标签
    if (!studentAnswer) return { verdict: 'blank', evidence: 'blank' };

    // 2/3. 老师批过的，以老师为准
    if (teacherMark === 'wrong') return { verdict: 'wrong', evidence: 'teacher' };
    if (teacherMark === 'right') return null;

    // 4. 没批过（或识别不出痕迹）：模型自判
    if (modelVerdict === 'wrong') return { verdict: 'wrong', evidence: 'model' };
    return null;
}

/**
 * 把模型返回的一条原始 item 重建成**只有白名单字段**的对象。
 * ★ 真正的"不给答案"就发生在这一步：模型就算多吐了 correctAnswer/analysis/solution，
 *   这里也不会搬运，返回体里根本不存在这些键。
 */
export function buildPaperItem(raw, pageNo) {
    if (!raw || typeof raw !== 'object') return null;
    const decision = decideFiling(raw);
    if (!decision) return null;

    const questionText = clip(raw.questionText || raw.q, MAX_Q);
    if (!questionText) return null; // 没题干就没法复习，宁可漏收

    const options = Array.isArray(raw.options)
        ? raw.options.map((o) => clip(o, MAX_OPT_LEN)).filter(Boolean).slice(0, MAX_OPT)
        : [];

    const tagRaw = str(raw.errorTag);
    const errorTag = ERROR_TAGS.includes(tagRaw)
        ? tagRaw
        : (decision.verdict === 'blank' ? '未作答' : '其他');

    const kps = Array.isArray(raw.knowledgePoints)
        ? raw.knowledgePoints.map((k) => clip(k, MAX_TAG_LEN)).filter(Boolean).slice(0, MAX_TAGS)
        : [];

    return {
        no: clip(raw.no, 24) || '?',
        section: clip(raw.section, 40),
        questionText,
        options,
        studentAnswer: clip(raw.studentAnswer, 600),
        verdict: decision.verdict,
        evidence: decision.evidence,
        errorTag,
        knowledgePoints: kps,
        pageNo: Number.isFinite(Number(pageNo)) ? Number(pageNo) : 1,
    };
}

/** 模型可能回 "A" / "a卷" / "B卷提高" —— 统一成 a/b/other，认不出就留空让库里回落默认值。 */
function normPaperLevel(v) {
    const s = str(v).toLowerCase();
    if (!s) return '';
    if (s.includes('b')) return 'b';
    if (s.includes('a')) return 'a';
    return 'other';
}

/** 批量重建 + 统计。raw.total 是模型报的"这一页一共几道题"，用来算漏掉了多少。 */
export function buildPaperResult(raw, pageNo) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const rawItems = Array.isArray(source.items) ? source.items : [];
    const items = [];
    for (const r of rawItems) {
        const it = buildPaperItem(r, pageNo);
        if (it) items.push(it);
    }
    const blank = items.filter((i) => i.verdict === 'blank').length;
    const wrong = items.length - blank;
    const total = Number.isFinite(Number(source.total)) && Number(source.total) > 0
        ? Number(source.total)
        : items.length;
    return {
        subject: clip(source.subject, 20),
        title: clip(source.title, 60),
        gradeSemester: clip(source.gradeSemester, 20),
        paperLevel: normPaperLevel(source.paperLevel),
        pageNo: Number(pageNo) || 1,
        items,
        stats: { total, wrong, blank, skipped: Math.max(0, Number(source.total || items.length) - items.length) },
        empty: items.length === 0 && (source.empty === true || rawItems.length === 0),
    };
}

/**
 * 最后一道出关口：把整页结果按字段白名单再拼一遍（接口层用）。
 * ★ 不重新做判定 —— 只搬允许的键；判对的题在 buildPaperResult 那一步已经丢了，
 *   所以这里绝不能"重新判一次"（那会因为缺 teacherMark/modelVerdict 把全部题误杀）。
 */
export function pickPaperResult(result) {
    const r = result && typeof result === 'object' ? result : {};
    const items = (Array.isArray(r.items) ? r.items : []).map((it) => {
        const out = {};
        for (const k of PAPER_ITEM_FIELDS) out[k] = it ? it[k] : undefined;
        return out;
    });
    const st = r.stats && typeof r.stats === 'object' ? r.stats : {};
    return {
        subject: str(r.subject),
        title: str(r.title),
        gradeSemester: str(r.gradeSemester),
        paperLevel: str(r.paperLevel),
        pageNo: Number(r.pageNo) || 1,
        items,
        stats: {
            total: Number(st.total) || items.length,
            wrong: Number(st.wrong) || 0,
            blank: Number(st.blank) || 0,
            skipped: Number(st.skipped) || 0,
        },
        empty: r.empty === true,
    };
}

/**
 * 从模型输出里抠 JSON。模型时不时会包 ```json 或加一句前言 —— 这里容错，
 * 但**不做任何"修复式补全"**：解析不出来就抛，让上层报 AI_RESPONSE_ERROR，
 * 绝不猜一个空结果冒充"这页没有错题"。
 */
export function parseJsonLoose(text) {
    const s = String(text || '').trim();
    if (!s) throw new Error('AI_RESPONSE_ERROR: empty response');
    const tryParse = (t) => {
        try { return JSON.parse(t); } catch { return undefined; }
    };
    let v = tryParse(s);
    if (v && typeof v === 'object') return v;
    // 去 code fence
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
        v = tryParse(fence[1].trim());
        if (v && typeof v === 'object') return v;
    }
    // 取第一个 { 到最后一个 }
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
        v = tryParse(s.slice(a, b + 1));
        if (v && typeof v === 'object') return v;
    }
    throw new Error('AI_RESPONSE_ERROR: not a JSON object');
}
