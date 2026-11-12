'use strict';
/**
 * 批次 WNPAPER 判据：拍整张卷子收错题
 * ============================================================
 * 用户诉求（原话）：「错题本这里应该增加一个拍卷子功能，自动将卷子中的错题和空白题都归入
 * 错题本，但是错题和空白题目不直接批改答案，避免学生利用这个功能抄作业」。
 *
 * 这个脚本守的核心不是"代码里写了什么"，而是**答案有没有可能漏出去**：
 *   A 段是**功能级**判据 —— 直接 import paper-rules.mjs，喂一份"故意塞满答案"的脏数据，
 *     断言 correctAnswer / analysis / solution 这些键在输出里根本不存在。
 *     （只靠 grep 源码的判据挡不住"顺手把一个字段透传出去"，那种改动 grep 看不出来。）
 *   B 段是接线判据 —— 保存接口、路由出关、提示词、详情页文案。
 *
 * 用法：
 *   node scripts/check-paper-scan.cjs
 *   WN_ROOT=/tmp/mut node scripts/check-paper-scan.cjs      # 反证用（指向被变异的副本）
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = process.env.WN_ROOT || path.join(__dirname, '..');

/** ★ 判据先剥注释再断言：注释里写着"改之前是 xxx"，不剥会整批红，逼人删说明来修绿。 */
const stripComments = (s) => {
    if (typeof s !== 'string') return '';
    let out = s.replace(/\/\*[\s\S]*?\*\//g, '');
    out = out.split('\n').map((l) => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*')) return '';
        return l;
    }).join('\n');
    return out;
};
const read = (rel) => {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return null;
    return stripComments(fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
};

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}` + (extra === undefined ? '' : `  → ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`)); }
};

const FORBIDDEN_KEYS = ['correctAnswer', 'analysis', 'answerText', 'answer', 'solution', 'steps', 'explanation', 'reason'];

(async () => {
    // ─────────────────────────── A. 功能级：答案漏得出去吗 ───────────────────────────
    console.log('\nA. 答案不可能外泄（喂脏数据，看白名单是不是真的挡住）');
    const rules = await import(pathToFileURL(path.join(ROOT, 'src/lib/ai/paper-rules.mjs')).href);

    const dirty = {
        subject: '数学',
        title: '第四单元测评',
        paperLevel: 'A卷',
        total: 5,
        items: [
            {   // 老师批错 + 模型顺手给了答案（最危险的一种）
                no: '1', questionText: '解方程 2x+1=5', studentAnswer: 'x=1',
                teacherMark: 'wrong', modelVerdict: 'wrong', errorTag: '计算错误',
                knowledgePoints: ['一元一次方程'],
                correctAnswer: 'x=2', answerText: 'x=2', analysis: '移项得 2x=4，故 x=2',
                solution: '2x+1=5 => 2x=4 => x=2', steps: ['移项', '合并'], reason: '应为 x=2',
            },
            {   // 空白题：必须收，且不能因为"没写"被丢掉
                no: '2', questionText: '计算 3/4 + 1/4', studentAnswer: '',
                teacherMark: 'none', modelVerdict: 'blank', errorTag: '未作答',
                knowledgePoints: ['分数加法'], correctAnswer: '1',
            },
            {   // 老师批对：不收
                no: '3', questionText: '3+3=', studentAnswer: '6',
                teacherMark: 'right', modelVerdict: 'right',
            },
            {   // 没批过 + 模型判对：不收
                no: '4', questionText: '4+4=', studentAnswer: '8',
                teacherMark: 'none', modelVerdict: 'right',
            },
            {   // 错因字段里夹带答案：必须被压成枚举词
                no: '5', questionText: '5+5=', studentAnswer: '11',
                teacherMark: 'none', modelVerdict: 'wrong', errorTag: '应为 10',
                knowledgePoints: ['加法', '进位', '口算', '第四个标签'],
            },
        ],
    };

    const res = rules.buildPaperResult(dirty, 3);

    ok('白名单：输出里没有任何答案类字段',
        res.items.every((it) => FORBIDDEN_KEYS.every((k) => !(k in it))),
        res.items.map((it) => Object.keys(it).join(',')).join(' | '));
    ok('白名单：序列化后的 JSON 里也搜不到 "x=2"（连值都没漏）',
        !JSON.stringify(res).includes('x=2') && !JSON.stringify(res).includes('移项'),
        JSON.stringify(res).slice(0, 200));
    ok('空题必收（verdict=blank / evidence=blank）',
        res.items.some((it) => it.no === '2' && it.verdict === 'blank' && it.evidence === 'blank'));
    ok('★ 老师批错优先：就算模型/字段里另有说法，仍按老师判 wrong + evidence=teacher',
        res.items.some((it) => it.no === '1' && it.verdict === 'wrong' && it.evidence === 'teacher'));
    ok('老师批对 ⇒ 不收录', !res.items.some((it) => it.no === '3'));
    ok('没批改痕迹 + 模型判对 ⇒ 不收录', !res.items.some((it) => it.no === '4'));
    ok('没批改痕迹 + 模型判错 ⇒ 收录且标 evidence=model',
        res.items.some((it) => it.no === '5' && it.evidence === 'model'));
    ok('★ 错因不在 7 个枚举词里 ⇒ 压成「其他」（模型想在这里写答案也写不进来）',
        (res.items.find((it) => it.no === '5') || {}).errorTag === '其他',
        (res.items.find((it) => it.no === '5') || {}).errorTag);
    ok('知识点最多留 3 个', ((res.items.find((it) => it.no === '5') || {}).knowledgePoints || []).length === 3);
    ok('统计：wrong/blank/total 自洽',
        res.stats.wrong === 2 && res.stats.blank === 1 && res.stats.total === 5, res.stats);
    ok('paperLevel 归一（"A卷" → a）', res.paperLevel === 'a', res.paperLevel);

    // 已构建的结果再过一次出关函数，不许把题杀掉（重新判定 = 缺 teacherMark 会全误杀）
    const picked = rules.pickPaperResult(res);
    ok('★ pickPaperResult 只搬键、不重新判定（条目一条不少）',
        picked.items.length === res.items.length, `${picked.items.length} vs ${res.items.length}`);
    ok('pickPaperResult 的输出同样不含答案字段',
        picked.items.every((it) => FORBIDDEN_KEYS.every((k) => !(k in it))));

    // 解析容错
    ok('能从 ```json 代码块里抠出对象',
        rules.parseJsonLoose('```json\n{"items":[]}\n```').items instanceof Array);
    let threw = false;
    try { rules.parseJsonLoose('模型今天不想输出 JSON'); } catch { threw = true; }
    ok('★ 解析不出来要抛错，不许静默返回空（空结果 = "这页没有错题"，会骗学生）', threw);

    // ─────────────────────────── B. 接线：这几段只要被改坏，功能就假了 ───────────────────────────
    console.log('\nB. 接线（保存接口 / 出关 / 提示词 / 详情页）');
    const save = read('src/app/api/paper-scans/route.ts');
    const analyzeRoute = read('src/app/api/analyze-paper/route.ts');
    const provider = read('src/lib/ai/openai-provider.ts');
    const prompts = read('src/lib/ai/prompts.ts');
    const detail = read('src/app/error-items/[id]/page.tsx');
    const schema = read('prisma/schema.prisma');
    const migration = read('prisma/migrations/20261112120000_add_paper_scan/migration.sql');

    ok('保存接口：answerText 落 null', /answerText:\s*null/.test(save || ''));
    ok('保存接口：analysis 落 null', /analysis:\s*null/.test(save || ''));
    ok('保存接口：mistakeAnalysis 落 null', /mistakeAnalysis:\s*null/.test(save || ''));
    ok('保存接口：打上 source=paper_scan（详情页据此隐藏答案区）', /source:\s*'paper_scan'/.test(save || ''));
    ok('保存接口：写入 paperScanId + paperPageNo', /paperScanId:/.test(save || '') && /paperPageNo:/.test(save || ''));
    ok('保存接口：不读请求体里的答案字段（body 解构里没有 answerText/analysis）',
        !/const\s*\{[^}]*\banswerText\b[^}]*\}\s*=\s*body/.test(save || ''));
    ok('识别路由：返回前过 pickPaperResult 出关', /pickPaperResult\(/.test(analyzeRoute || ''));
    ok('识别路由：provider 没实现时明确报错，不静默返回空',
        /analyzePaperPage\s*!==\s*'function'|typeof\s+aiService\.analyzePaperPage/.test(analyzeRoute || ''));
    ok('provider：走 buildPaperResult 白名单重建', /buildPaperResult\(/.test(provider || ''));
    ok('provider：整卷识别也关思考链（enable_thinking:false）', /enable_thinking:\s*false/.test(provider || ''));

    ok('提示词：明写"任何字段都不许出现答案"', /任何字段都不许出现答案/.test(prompts || ''));
    ok('提示词：错因限定 7 个枚举词', /计算错误 \/ 概念不清 \/ 审题不清 \/ 方法不会 \/ 格式单位 \/ 未作答 \/ 其他/.test(prompts || ''));
    ok('提示词：老师批改痕迹优先于模型自判', /以老师为准/.test(prompts || ''));
    ok('提示词：空白题必须进 items', /空题也必须进 items/.test(prompts || ''));
    ok('★ 提示词不许被线上配置覆盖（customTemplate 一旦接上，红线就能被关掉）',
        !/generatePaperPrompt[\s\S]{0,600}customTemplate/.test(prompts || ''));

    ok('详情页：拍照收卷的题用 lockedNotice 顶掉答案区',
        /paperScanId && !item\.answerText/.test(detail || '') && /paperLockedNotice/.test(detail || ''));
    ok('详情页：解析区同样不给', /paperScanId && !item\.analysis/.test(detail || ''));
    ok('详情页：可以回看原卷那一页（不是回看单题图）', /togglePaperPage/.test(detail || ''));

    ok('schema：PaperPage 对 (scanId,pageNo) 唯一 —— 一页只存一份图',
        /@@unique\(\[scanId, pageNo\]\)/.test(schema || ''));
    ok('schema：ErrorItem 只加两个可空列，不声明外键关系（老数据零影响）',
        /paperScanId\s+String\?/.test(schema || '') && /paperPageNo\s+Int\?/.test(schema || ''));
    ok('迁移：两条 ADD COLUMN 都是可空列',
        /ALTER TABLE "ErrorItem" ADD COLUMN "paperScanId" TEXT;/.test(migration || '') &&
        /ALTER TABLE "ErrorItem" ADD COLUMN "paperPageNo" INTEGER;/.test(migration || ''));
    ok('迁移：没有 DROP / 没有重建 ErrorItem 表（SQLite 重建 = 动全库最核心的表）',
        !/DROP TABLE/i.test(migration || '') && !/RENAME TO/i.test(migration || '') &&
        (migration || '').split('ALTER TABLE "ErrorItem"').length - 1 === 2);

    // ───────── C. 解题器闸门：把答案卡按住还不够，还有三条路能把答案送到学生手里 ─────────
    // 这一段是**红线判据**，不是"顺手加的功能"：
    //   详情页的「问小老师」「视频讲解」「GeoGebra 演示」、练习页的逐空判分，
    //   任何一条留口子，「防抄作业」就整体失效（学生拍完卷子点一下就能拿到完整解法）。
    console.log('\nC. 解题器闸门（小老师 / 视频讲解 / GeoGebra / 练习页判分）');
    const practice = read('src/app/practice/page.tsx');

    ok('详情页：fromPaperScan 的判据是 paperScanId（不是另编一个标记）',
        /const fromPaperScan = !!item\.paperScanId/.test(detail || ''));
    ok('★ 详情页：「问小老师」按钮对拍卷题不渲染', /!fromPaperScan && \(\s*<Button[^>]*onClick=\{openTutor\}/.test(detail || ''));
    ok('★ 详情页：TutorChat 整块不挂载（它监听 wn:tutor-open，藏起来也会被父页面唤起）',
        /!fromPaperScan && \(\s*<TutorChat/.test(detail || ''));
    ok('★ 详情页：视频讲解被换成锁定说明（出片就是完整解题过程）',
        /fromPaperScan \? solverLockedNotice : <VideoExplain/.test(detail || ''));
    ok('★ 详情页：GeoGebra 演示对拍卷题不挂载', /fromPaperScan \? null : item\.geogebraCommands/.test(detail || ''));

    ok('练习页：认出"这道题没有标准答案"', /const hasKeyAnswer = !!\(question\?\.answerText \|\| ""\)\.trim\(\)/.test(practice || ''));
    ok('★ 练习页：没有答案就不比对、不判分、不亮答案卡，直接收工',
        /if \(!hasKeyAnswer\) \{[\s\S]{0,240}setShowAnswer\(false\)[\s\S]{0,240}return;/.test(practice || ''));
    ok('★ 练习页：答案区挂上 hasKeyAnswer（否则空答案也会渲染出一张"正确答案"卡）',
        /\{showAnswer && hasKeyAnswer && \(/.test(practice || ''));
    ok('练习页：拍卷题不给"答案有误"的红叉（学生没答错，是没答案可对）',
        /!hasKeyAnswer \? "border-dashed/.test(practice || ''));

    console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
    process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
});
