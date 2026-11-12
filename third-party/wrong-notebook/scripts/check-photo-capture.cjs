'use strict';
/**
 * 错题本「拍照收题」验收判据（批次 WNCROP）
 *
 * 背景（用户报障原话）：
 *   「现在错题本拍照识别错题为什么这么慢？而且错题拍照应该自动全屏操作，
 *     不然题目很小不好手动裁剪」
 *
 * 这个脚本守的是**两件事的成因**，不是"字面有没有写"：
 *   · 慢 → 前端等多久(300s) / 服务端何时先超时(280s < 300s) / SDK 别叠重试
 *          / 上游思考链关掉(enable_thinking:false) / 关思考必须有兜底
 *   · 裁剪器小 → 弹窗是否真铺满视口 / 图片有没有被 70vh 封顶 / 有没有放大
 *   · 顺带守"91% 冻结"：进度条不许再用随机步长，必须按真实秒数推进
 *
 * 用法：
 *   node scripts/check-photo-capture.cjs
 *   WN_ROOT=/tmp/mut node scripts/check-photo-capture.cjs     # 反证用（指向被变异的副本）
 *
 * 约定：末行输出 `通过 N 项，失败 M 项`，有失败则 exit 1。
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.env.WN_ROOT || path.join(__dirname, '..');
/**
 * ★★★ 判据必须先剥注释再断言。这批注释里写着"改之前是 max-w-3xl / 70vh / Math.random()"，
 *   不剥就直接 grep ⇒ 明明已经修好了，断言却红（判据自己写错比没判据更坏：
 *   会逼着后来人把说明注释删掉来"修绿"）。
 */
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

const F = {
    config: read('src/lib/config.ts'),
    provider: read('src/lib/ai/openai-provider.ts'),
    cropper: read('src/components/image-cropper.tsx'),
    feedback: read('src/components/ui/progress-feedback.tsx'),
    addPage: read('src/app/notebooks/[id]/add/page.tsx'),
    homePage: read('src/app/page.tsx'),
    imageUtils: read('src/lib/image-utils.ts'),
    translations: read('src/lib/translations.ts'),
};

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}` + (extra === undefined ? '' : `  → ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`)); }
};
const has = (s, sub) => typeof s === 'string' && s.includes(sub);
const num = (s, re) => { const m = (s || '').match(re); return m ? Number(m[1]) : NaN; };
/** 只取 analyzeImage 方法体（从方法签名到下一个 `async ` 方法），避免拿别的方法的字段凑数 */
const analyzeBody = (() => {
    const s = F.provider || '';
    const i = s.indexOf('async analyzeImage(');
    if (i < 0) return '';
    const j = s.indexOf('async generateSimilarQuestion(', i);
    return j > i ? s.slice(i, j) : s.slice(i);
})();

// ─────────────────────────────────── A. 超时口径：前端比服务端更能忍 ───────────────────────────────────
console.log('\nA. 超时口径（前端 300s / 服务端 280s 先超时）');
const frontTimeout = num(F.config, /analyze:\s*(\d+)/);
const sdkTimeout = num(F.provider, /timeout:\s*(\d+)\s*,?\s*\n\s*maxRetries/);
ok('config.timeouts.analyze === 300000（前端肯等 5 分钟）', frontTimeout === 300000, frontTimeout);
ok('OpenAI SDK timeout === 280000（服务端先于前端超时）', sdkTimeout === 280000, sdkTimeout);
ok('★ 服务端超时严格小于前端（否则前端 abort、服务端白跑）',
    Number.isFinite(frontTimeout) && Number.isFinite(sdkTimeout) && sdkTimeout < frontTimeout,
    `${sdkTimeout} < ${frontTimeout}?`);
ok('SDK maxRetries === 1（不再 1 次抖动叠成 3 倍时长）',
    /maxRetries:\s*1\b/.test(F.provider || ''));

// ─────────────────────────────────── B. 关思考 + 兜底 ───────────────────────────────────
console.log('\nB. 上游思考链（提速主项）');
ok('analyzeImage 请求体带 enable_thinking: false', /enable_thinking:\s*false/.test(analyzeBody));
// ★ 别写 `/:\s*(?!false\b)/` 这种否定前瞻：`\s*` 会回溯成"匹配 0 个空格"，
//   于是 " enable_thinking: false" 也被判成"没有紧跟 false" ⇒ 断言恒红。改成把值抓出来逐个比。
const thinkAssignments = (F.provider || '').match(/enable_thinking\s*:\s*[A-Za-z0-9_.$]+/g) || [];
ok('★ 全文不存在"开思考"的赋值（enable_thinking 只许出现成 false，不许有 true / 变量）',
    thinkAssignments.length > 0 && thinkAssignments.every((v) => /:\s*false$/.test(v)),
    thinkAssignments.join(' | '));
ok('定义了 isUnknownParamError（识别"网关不认这个参数"）',
    /function isUnknownParamError\(/.test(F.provider || ''));
ok('analyzeImage 里真的调用了它并重试', /isUnknownParamError\(/.test(analyzeBody) && /catch\s*\(/.test(analyzeBody));
ok('★ 兜底重试用的是 baseParams（不含 enable_thinking 的原参数）',
    /create\(baseParams\)/.test(analyzeBody));
ok('兜底只对 400/422 生效（别的错误照样抛，不白花额度）',
    /status\s*!==\s*400\s*&&\s*status\s*!==\s*422/.test(F.provider || ''));

// ─────────────────────────────────── C. 裁剪器全屏 ───────────────────────────────────
console.log('\nC. 裁剪器铺满视口');
ok('DialogContent 含 w-screen', has(F.cropper, 'w-screen'));
ok('DialogContent 含 h-screen', has(F.cropper, 'h-screen'));
ok('用了 100dvh（避开手机地址栏吃掉高度）', has(F.cropper, '100dvh'));
ok('已经去掉 max-w-3xl 这类窄弹窗宽度', !has(F.cropper, 'max-w-3xl'));
ok('★ 图片不再被 70vh 封顶（原来 390×844 上题目只剩 273px 宽）', !has(F.cropper, 'maxHeight: 70vh') && !has(F.cropper, 'max-h-[70vh]'));
ok('有 1× / 2× 放大按钮', has(F.cropper, '1×') && has(F.cropper, '2×'));
ok('★ 放大改的是真实布局宽度（width %），不是 transform: scale（后者会让 getBoundingClientRect 翻倍错位）',
    /width:\s*`\$\{zoom \* 100\}%`/.test(F.cropper) && !/transform:\s*[`'"]?scale/.test(F.cropper));

// ─────────────────────────────────── D. 裁剪坐标与渲染尺寸解耦 ───────────────────────────────────
console.log('\nD. 裁剪坐标按百分比现算');
ok('存在 c.x / 100 的百分比换算', /c\.x\s*\/\s*100/.test(F.cropper));
ok('存在 c.width / 100 的百分比换算', /c\.width\s*\/\s*100/.test(F.cropper));
ok('★ 不再拿 completedCrop 的渲染像素去裁剪（放大后必错位）',
    !/completedCrop\.(width|height|x|y)/.test(F.cropper));
ok('没拖过也能"确认"（crop 为 undefined 时兜底按整幅图）',
    /crop\s*\|\|/.test(F.cropper) || /if\s*\(!crop\)/.test(F.cropper) || /crop\s*\?\?/.test(F.cropper));

// ─────────────────────────────────── E. 进度条不再"91% 冻结" ───────────────────────────────────
console.log('\nE. 进度按真实秒数推进（原来随机步长常一步跳到 91~99 后永久冻结）');
ok('add 页不再用 Math.random() 推进进度', !/setProgress\([^)]*Math\.random/.test(F.addPage));
ok('首页不再用 Math.random() 推进进度', !/setProgress\([^)]*Math\.random/.test(F.homePage));
ok('add 页把 elapsedSec 传给进度组件', /elapsedSec=\{elapsedSec\}/.test(F.addPage));
ok('首页把 elapsedSec 传给进度组件', /elapsedSec=\{elapsedSec\}/.test(F.homePage));
ok('进度组件支持 elapsedSec 并显示真实秒数', /elapsedSec/.test(F.feedback) && /\bs\b/.test(F.feedback));
ok('超过 45 秒会明确说"还在跑"（stillWorking）', /stillWorking/.test(F.feedback) && /stillWorking/.test(F.translations));
ok('中文文案里有"请先别关页面"这类安抚', has(F.translations, '请先别关页面'));

// ─────────────────────────────────── F. 上传体积（视觉 token 按像素切块，直接影响耗时与钱） ───────────────────────────────────
console.log('\nF. 上传前压缩');
ok('compressImage 默认 maxWidth 收到 1600（1920 → 1600 省约三成视觉 token）',
    /maxWidth[^\n]*=\s*1600|maxWidth:\s*1600/.test(F.imageUtils), num(F.imageUtils, /maxWidth[^\n]*?1600/) ? '' : 'not found');

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
