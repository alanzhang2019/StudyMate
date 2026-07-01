// Test that two stacked problems are detected as separate problem groups,
// not merged into one giant block.

const { chromium } = require('d:/AItrade/ai-math-mistake-machine/frontend/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
const BASE_URL = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  let pass = 0, fail = 0;
  const expect = (cond, msg) => {
    if (cond) { console.log(`  ✓ ${msg}`); pass++; }
    else { console.log(`  ✗ ${msg}`); fail++; }
  };

  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('[detect-problem]')) console.log('  PAGE:', t);
  });

  const sharp = require('D:/AItrade/ai-math-mistake-machine/frontend/node_modules/sharp');
  // 800x800 image with TWO problems stacked vertically, each ~300px tall,
  // with a 50px gap between them (clearly different problems)
  const testImage = await sharp({
    create: { width: 800, height: 800, channels: 3, background: { r: 250, g: 250, b: 250 } },
  })
    .composite([
      {
        input: Buffer.from(`<svg width="500" height="300">
          <rect width="500" height="300" fill="white" />
          <text x="10" y="30" font-size="20" fill="black">1. 解决问题</text>
          <text x="10" y="80" font-size="16" fill="black">养鸡场用5个鸡蛋孵小鸡,</text>
          <text x="10" y="110" font-size="16" fill="black">上午孵出476只小鸡,</text>
          <text x="10" y="140" font-size="16" fill="black">下午比上午少孵出107只,</text>
          <text x="10" y="170" font-size="16" fill="black">下午孵出多少只小鸡?</text>
        </svg>`),
        top: 50,
        left: 100,
      },
      {
        input: Buffer.from(`<svg width="500" height="300">
          <rect width="500" height="300" fill="white" />
          <text x="10" y="30" font-size="20" fill="black">2. 解决问题</text>
          <text x="10" y="80" font-size="16" fill="black">学校买来6箱粉笔,</text>
          <text x="10" y="110" font-size="16" fill="black">每箱48盒,</text>
          <text x="10" y="140" font-size="16" fill="black">平均分给8个班,</text>
          <text x="10" y="170" font-size="16" fill="black">每个班分到多少盒?</text>
        </svg>`),
        top: 400,
        left: 100,
      },
    ])
    .png()
    .toBuffer();

  await page.goto(`${BASE_URL}/mistake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  const fileInput = await page.$('input[type="file"]');
  console.log('Test: two stacked problems should be detected as separate groups');
  await fileInput.setInputFiles([{ name: 'test.png', mimeType: 'image/png', buffer: testImage }]);
  await page.waitForTimeout(6000);

  const box = await page.evaluate(() => {
    const crop = Array.from(document.querySelectorAll('div')).find(
      (d) => d.className && d.className.includes('absolute') && d.className.includes('border'),
    );
    if (!crop) return null;
    const style = crop.getAttribute('style') || '';
    const top = parseFloat(style.match(/top:\s*([\d.]+)/)?.[1] || '0');
    return { top, h: crop.offsetHeight };
  });
  console.log('  Detected box:', JSON.stringify(box));
  expect(box !== null, 'crop box found');

  if (box) {
    // Image scale: 800x800 image -> 480x480 display, scale = 0.6
    // Problem 1: image y=50..350, display y=30..210 (height 180)
    // Gap: image y=350..400, display y=210..240
    // Problem 2: image y=400..700, display y=240..420 (height 180)
    //
    // Expected: detection picks PROBLEM 1 only (top portion)
    // box top should be ~30 (display), box height should be ~180-220 (display)
    //
    // If algorithm incorrectly merged both problems, box top would be ~30
    // BUT box height would be ~390 (covering both problems through y=700 in image)

    const displayBoxTop = box.top;
    const displayBoxHeight = box.h;
    // The total height of both problems in display is ~390 (from y=30 to y=420)
    // A correctly-bounded problem 1 should have display height < 280 (with padding)
    expect(
      displayBoxHeight < 280,
      `single problem height ${displayBoxHeight}px (should be < 280px, not 390+ which would be merged)`,
    );
    // And the top should be in the upper part (problem 1)
    expect(
      displayBoxTop < 80,
      `top ${displayBoxTop}px is in upper part of image (problem 1)`,
    );
  }

  await page.screenshot({ path: 'two-problems-test.png' });

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
