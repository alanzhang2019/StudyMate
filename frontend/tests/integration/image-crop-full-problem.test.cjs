// Test that a multi-line problem with a right-side calculation column is
// captured as ONE complete problem (title + body + calcs), not split.

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
  // 1000x700 image simulating: a problem with title + 5 body lines + 5 right
  // column equations. Lines are spaced 50-70px apart (taller than before
  // to mimic real photo scale).
  const testImage = await sharp({
    create: { width: 1000, height: 700, channels: 3, background: { r: 250, g: 250, b: 250 } },
  })
    .composite([
      {
        input: Buffer.from(`<svg width="800" height="600">
          <rect width="800" height="600" fill="white" />
          <text x="20" y="40" font-size="28" fill="black">1. 解决问题</text>
          <text x="20" y="120" font-size="24" fill="black">养鸡场用5个鸡蛋孵小鸡,</text>
          <text x="20" y="180" font-size="24" fill="black">上午孵出476只小鸡,</text>
          <text x="20" y="240" font-size="24" fill="black">下午比上午少孵出107只,</text>
          <text x="20" y="300" font-size="24" fill="black">下午孵出多少只小鸡?</text>
          <text x="500" y="120" font-size="22" fill="black">596×3=</text>
          <text x="500" y="180" font-size="22" fill="black">80×6=</text>
          <text x="500" y="240" font-size="22" fill="black">18+3=</text>
          <text x="500" y="300" font-size="22" fill="black">48-32=</text>
        </svg>`),
        top: 50,
        left: 100,
      },
    ])
    .png()
    .toBuffer();

  await page.goto(`${BASE_URL}/mistake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  const fileInput = await page.$('input[type="file"]');
  console.log('Test: multi-line problem with right column should be detected as one group');
  await fileInput.setInputFiles([{ name: 'test.png', mimeType: 'image/png', buffer: testImage }]);
  await page.waitForTimeout(6000);

  const box = await page.evaluate(() => {
    const crop = Array.from(document.querySelectorAll('div')).find(
      (d) => d.className && d.className.includes('absolute') && d.className.includes('border'),
    );
    if (!crop) return null;
    const style = crop.getAttribute('style') || '';
    const top = parseFloat(style.match(/top:\s*([\d.]+)/)?.[1] || '0');
    const left = parseFloat(style.match(/left:\s*([\d.]+)/)?.[1] || '0');
    return { top, left, w: crop.offsetWidth, h: crop.offsetHeight };
  });
  console.log('  Detected box:', JSON.stringify(box));
  expect(box !== null, 'crop box found');

  if (box) {
    // Image 1000x700, displayed in 480px wide container.
    // Actual scale depends on image aspect: for 1000x700, scale is
    // min(480/1000, 480/700) = 0.48. So display dimensions are
    // approximately 480 × 336.
    // The problem region in image space is roughly:
    //   x: 100..900 (800 wide)
    //   y: 50..360 (310 tall, from title top to last calc)
    //
    // Expected: a single crop box covering MOST of this region
    //   - display x: small padding from 0
    //   - display y: small padding from 0
    //   - display width: 380+ (covering most of the 480px display)
    //   - display height: 160+ (covering most of the 336px display)

    // Most importantly: the box should include the title (y near top) AND
    // the bottom of the calcs. A correctly-merged full problem would have
    // height >= 140px in display. A fragment (just bottom 2 lines) would
    // have height ~ 50-70px.
    expect(
      box.h >= 140,
      `box height ${box.h}px includes full multi-line problem (not a fragment)`,
    );
    // And the box should be wide enough to include the right column
    expect(
      box.w >= 280,
      `box width ${box.w}px spans both main and right column (not just left)`,
    );
  }

  await page.screenshot({ path: 'full-problem-test.png' });

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
