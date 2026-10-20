/**
 * 教材 PDF 阅读器 —— 真浏览器端到端验证
 *
 * 跑法（必须在 frontend/ 下）：
 *   NODE_PATH=C:/Users/Administrator/.workbuddy-ai/binaries/node/workspace/node_modules \
 *   node scripts/verify-textbook-reader.cjs [--port 3230] [--slug math-bnu-g7a]
 *
 * 前置：
 *   1. dev server 已起（npx next dev --webpack -p 3230）
 *   2. public/textbooks/<slug>.pdf 存在（gitignored，测试夹具）
 *      curl -o public/textbooks/math-bnu-g7a.pdf https://aijiangti.cn/textbooks/math-bnu-g7a.pdf
 *
 * 为什么必须有这个脚本：
 *   这次改动的核心是「浏览器插件式的 iframe → canvas 虚拟滚动阅读器」。
 *   老实现里页码是浏览器 PDF 插件的只读文本；新实现里页码是 DOM 输入框，
 *   能不能跳、滚回去页码会不会跟着变、缩放是否真改了画布尺寸——
 *   这些都不是单测能覆盖的，只有真浏览器 + 真 PDF 才能证明。
 *
 * 断言清单（12 条）全部锚「用户可见行为」，不锚实现细节。
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

/**
 * playwright-core 自带的版本号跟本机已装的 Chromium 构建号常常对不上
 * （例如它找 chromium_headless_shell-1243，本机只有 -1208/-1217/-1223/-1248），
 * 直接 launch() 会报 "Executable doesn't exist" 并让你去 install 一个几百 MB 的包。
 * 与其为了一次验证下载整个浏览器，不如复用本机已有的完整 Chromium：
 * 扫 ms-playwright 目录取最大构建号的 chrome.exe 交给 executablePath。
 */
function resolveChromium() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'),
    path.join(process.env.HOME || '', '.cache', 'ms-playwright'),
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const builds = fs
      .readdirSync(root)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const b of builds) {
      const exe = path.join(root, b, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
      const exeMac = path.join(root, b, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
      if (fs.existsSync(exeMac)) return exeMac;
      const exeLinux = path.join(root, b, 'chrome-linux', 'chrome');
      if (fs.existsSync(exeLinux)) return exeLinux;
    }
  }
  return undefined; // 交给 playwright-core 默认解析
}

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const PORT = Number(getArg('port', '3230'));
const SLUG = getArg('slug', 'math-bnu-g7a');
const BASE = `http://127.0.0.1:${PORT}`;
const EXPECT_PAGES = 209;

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  \u2713 ${name}${extra ? '  ' + extra : ''}`);
  } else {
    fail += 1;
    console.log(`  \u2717 ${name}${extra ? '  ' + extra : ''}`);
  }
};

(async () => {
  const exe = resolveChromium();
  console.log(`\n  浏览器: ${exe || '(playwright 默认)'}`);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') jsErrors.push(m.text());
  });

  console.log(`\n=== 教材阅读器 E2E  @ ${BASE}  slug=${SLUG} ===\n`);
  // 教材页是独立路由 /textbooks（首页只是落地页），默认就是 textbook 模式
  await page.goto(`${BASE}/textbooks`, { waitUntil: 'domcontentloaded' });

  // --- 1. 筛到目标教材，点在线阅读 ---
  console.log('[1] 打开教材');
  // ⚠️ dev 专有两个坑（prod 实测都没有）：
  //   ① hydration 完成前的点击打在 SSR HTML 上，onClick 还没挂，被静默丢弃；
  //   ② 首访约 1 秒后 Next dev 会做一次 HMR 全量重载，把已生效的筛选态清回默认。
  // 对策不是硬编码 sleep，而是「点了看卡片、且隔 1s 仍然是」的稳定性自证重试——
  // 重载后的页面是稳态的，连续两次都看到的列表才算真生效。
  const hasMathCard = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('article h2')].some((e) => /数学/.test(e.textContent || '')),
    );
  const firstCardIsG7Math = () =>
    page.evaluate(() => {
      const h = document.querySelector('article h2');
      return !!h && /数学 · 七年级/.test(h.textContent || '');
    });

  await page.waitForTimeout(2000); // 先让首访重载窗口过去

  let subjectOk = false;
  for (let i = 0; i < 20 && !subjectOk; i += 1) {
    await page.getByRole('button', { name: /数学/ }).first().click();
    await page.waitForTimeout(500);
    if (!(await hasMathCard())) continue; // 点击被丢（未 hydration）或又被重载抹了
    await page.waitForTimeout(1000);
    subjectOk = await hasMathCard(); // 1s 后仍在 = 抗过了重载窗口
  }
  ok('学科筛选生效且稳定（列表只剩数学）', subjectOk);

  let gradeOk = false;
  for (let i = 0; i < 10 && !gradeOk; i += 1) {
    await page.getByRole('button', { name: /七年级/ }).first().click();
    await page.waitForTimeout(600);
    gradeOk = await firstCardIsG7Math();
  }
  ok('年级筛选生效（首卡=数学七年级）', gradeOk);

  const openBtn = page.getByRole('button', { name: /在线阅读/ }).first();
  await openBtn.waitFor({ timeout: 15000 });
  await openBtn.click();
  await page.waitForTimeout(1500);

  // 工具栏出现 = 阅读器接管（老实现这里是浏览器插件，没有这些 DOM）
  const input = page.locator('[data-testid="reader-page-input"]');
  await input.waitFor({ timeout: 30000 });

  // 打开的必须是目标教材：锚「阅读器弹层顶栏的书名」而不是卡片标题
  // （卡片在弹层背后也含同名文字，锚错了会在开错书（语文 404）时假绿）
  const modalTitle = await page
    .locator('div.fixed.inset-0')
    .first()
    .locator('p')
    .first()
    .textContent()
    .catch(() => '');
  ok('阅读器打开的是数学·七年级·上册', /数学 · 七年级/.test(modalTitle || ''), `"${(modalTitle || '').trim()}"`);

  // --- 2. 总页数识别 ---
  console.log('[2] 总页数识别');
  await page.waitForTimeout(2500);
  const totalText = await page
    .locator('text=/\\/ ' + EXPECT_PAGES + '/')
    .first()
    .textContent()
    .catch(() => '');
  ok('识别到 209 页', /209/.test(totalText || ''), `"${(totalText || '').trim()}"`);

  // --- 3. 首页真有墨迹（不是空白画布）---
  console.log('[3] 首页渲染');
  const inkPixels = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return -1;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) n += 1;
    }
    return n;
  });
  ok('首页画布有内容', inkPixels > 1000, `非白像素采样=${inkPixels}`);

  // --- 4. 虚拟滚动：画布数量远小于总页数 ---
  console.log('[4] 虚拟滚动');
  const canvasCount = await page.locator('canvas').count();
  ok('只挂少量 canvas（虚拟滚动生效）', canvasCount > 0 && canvasCount <= 6, `canvas=${canvasCount} / 共 ${EXPECT_PAGES} 页`);

  // --- 5. 跳页：输入 120 + 回车 ---
  console.log('[5] 页码跳转');
  await input.click();
  await input.fill('120');
  await input.press('Enter');
  await page.waitForTimeout(1800);
  const afterJump = await input.inputValue();
  ok('跳到第 120 页', afterJump === '120', `输入框="${afterJump}"`);

  const jumped = await page.evaluate(() => {
    const el = document.querySelector('[data-pg]')?.parentElement?.parentElement;
    const sc = [...document.querySelectorAll('*')].find(
      (e) => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 300,
    );
    return sc ? Math.round(sc.scrollTop) : -1;
  });
  ok('容器滚动位置已同步', jumped >= 0, `scrollTop=${jumped}`);

  // 页码 120 的页面容器真的进了可视区
  const pg120Visible = await page.evaluate(() => {
    const c = document.querySelector('[data-page="120"], [data-pg="120"]');
    if (!c) return 'no-node';
    const r = c.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0 ? 'visible' : `offscreen(top=${Math.round(r.top)})`;
  });
  ok('第 120 页进入可视区', pg120Visible === 'visible', pg120Visible);

  // --- 6. 上一页/下一页按钮 ---
  console.log('[6] 上一页 / 下一页');
  await page.locator('[data-testid="reader-next"]').click();
  await page.waitForTimeout(1200);
  const afterNext = await input.inputValue();
  ok('下一页 → 121', afterNext === '121', `="${afterNext}"`);

  await page.locator('[data-testid="reader-prev"]').click();
  await page.waitForTimeout(1200);
  const afterPrev = await input.inputValue();
  ok('上一页 → 120', afterPrev === '120', `="${afterPrev}"`);

  // --- 7. 缩放真改了画布尺寸 ---
  console.log('[7] 缩放');
  const w0 = await page.evaluate(() => document.querySelector('canvas')?.getBoundingClientRect().width || 0);
  await page.locator('[data-testid="reader-zoom-in"]').click();
  await page.waitForTimeout(1500);
  const w1 = await page.evaluate(() => document.querySelector('canvas')?.getBoundingClientRect().width || 0);
  ok('放大后画布变宽', w1 > w0, `${Math.round(w0)} → ${Math.round(w1)}px`);

  await page.locator('[data-testid="reader-zoom-reset"]').click();
  await page.waitForTimeout(1200);
  const w2 = await page.evaluate(() => document.querySelector('canvas')?.getBoundingClientRect().width || 0);
  ok('重置后画布还原', Math.abs(w2 - w0) < 3, `${Math.round(w2)}px ≈ ${Math.round(w0)}px`);

  // --- 8. 越界输入被夹回 ---
  console.log('[8] 越界保护');
  await input.click();
  await input.fill('99999');
  await input.press('Enter');
  await page.waitForTimeout(1200);
  const clamped = await input.inputValue();
  ok('99999 被夹到有效范围', Number(clamped) <= EXPECT_PAGES && Number(clamped) >= 1, `="${clamped}"`);

  // --- 9. 键盘翻页 ---
  console.log('[9] 键盘翻页');
  const before = Number(await input.inputValue());
  await page.locator('body').click({ position: { x: 400, y: 400 } });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1000);
  const afterKey = Number(await input.inputValue());
  ok('→ 键翻到下一页', afterKey === before + 1, `${before} → ${afterKey}`);

  // --- 10. 零 JS 错误 ---
  console.log('[10] 控制台');
  ok('无 JS 报错', jsErrors.length === 0, jsErrors.length ? jsErrors.slice(0, 2).join(' | ') : '');

  await page.screenshot({ path: '_tb-reader.png', fullPage: false });
  console.log('\n  截图: _tb-reader.png');

  await browser.close();
  console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('\nE2E 崩了:', e && e.message);
  process.exit(1);
});
