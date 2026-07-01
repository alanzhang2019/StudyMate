// Realistic test: simulates a phone photo of a textbook with a hand
// holding the book on the left and a black phone/device in the middle.
// Only the right column should be selected as the "problem region".

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
  page.on('pageerror', (e) => console.log('  PAGE ERROR:', e.message));

  // Realistic test image:
  // - 800x800 white background
  // - Left side (0-200): "hand" (light gray, low edge density)
  // - Middle (300-450): "phone" (dark gray, medium edge density)
  // - Right (550-770): "math problem column" (white bg + black text, HIGH density)
  const sharp = require('D:/AItrade/ai-math-mistake-machine/frontend/node_modules/sharp');
  const testImage = await sharp({
    create: { width: 800, height: 800, channels: 3, background: { r: 250, g: 250, b: 250 } },
  })
    .composite([
      // Hand: light gray rectangle, smooth (low edge density)
      {
        input: Buffer.from(`<svg width="200" height="800">
          <rect width="200" height="800" fill="#d4a574" />
          <line x1="40" y1="200" x2="80" y2="700" stroke="#b8956a" stroke-width="3" />
        </svg>`),
        top: 0,
        left: 0,
      },
      // Phone: dark rectangle (medium density)
      {
        input: Buffer.from(`<svg width="150" height="500">
          <rect width="150" height="500" fill="#1a1a1a" />
          <rect x="20" y="20" width="110" height="20" fill="#333" />
          <rect x="20" y="60" width="110" height="380" fill="#222" />
        </svg>`),
        top: 200,
        left: 300,
      },
      // Math problem column: high density
      {
        input: Buffer.from(`<svg width="220" height="700">
          <rect width="220" height="700" fill="white" />
          <text x="10" y="30" font-size="18" fill="black">4. Solve the problems.</text>
          <text x="10" y="60" font-size="14" fill="black">Section IV.</text>
          <text x="10" y="100" font-size="16" fill="black">(1) 104 × 8 =</text>
          <text x="10" y="130" font-size="16" fill="black">(2) 430 - 350 =</text>
          <text x="10" y="160" font-size="16" fill="black">(3) 9 × 700 =</text>
          <text x="10" y="200" font-size="14" fill="black">Answer:</text>
          <text x="10" y="230" font-size="14" fill="black">642 - 238 =</text>
          <text x="10" y="260" font-size="14" fill="black">447 × 6 =</text>
          <text x="10" y="290" font-size="14" fill="black">596 × 3 =</text>
          <text x="10" y="320" font-size="14" fill="black">80 × 6 =</text>
          <text x="10" y="350" font-size="14" fill="black">18 + 3 =</text>
          <text x="10" y="380" font-size="14" fill="black">48 - 32 =</text>
          <text x="10" y="410" font-size="14" fill="black">18 - 37 =</text>
        </svg>`),
        top: 50,
        left: 560,
      },
    ])
    .png()
    .toBuffer();

  await page.goto(`${BASE_URL}/mistake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000); // OpenCV pre-warm

  const fileInput = await page.$('input[type="file"]');
  console.log('Test: detection prefers dense text over smooth hand/phone');
  await fileInput.setInputFiles([{ name: 'test.png', mimeType: 'image/png', buffer: testImage }]);
  await page.waitForTimeout(6000);

  // Get the crop box position
  const box = await page.evaluate(() => {
    const crop = Array.from(document.querySelectorAll('div')).find(
      (d) => d.className && d.className.includes('absolute') && d.className.includes('border'),
    );
    if (!crop) return null;
    const style = crop.getAttribute('style') || '';
    const left = parseFloat(style.match(/left:\s*([\d.]+)/)?.[1] || '0');
    const top = parseFloat(style.match(/top:\s*([\d.]+)/)?.[1] || '0');
    return { left, top, w: crop.offsetWidth, h: crop.offsetHeight };
  });
  console.log('  Detected box:', JSON.stringify(box));
  expect(box !== null, 'crop box found in DOM');

  if (box) {
    // The math problem column is at x=560..780 (out of 800 image width).
    // In the 480px display, the right 50% of the image (x=240..480 in display)
    // should be selected, NOT the hand (left) or phone (middle).
    // Display ratio: displayW / imgW = 480/800 = 0.6 (assuming 1:1 fit)
    // Text column display: x ≈ 560*0.6 = 336, y ≈ 50*0.6 = 30
    // Hand display: x ≈ 0..120
    // Phone display: x ≈ 180..270
    // So text column should be in display x > 280 area (right half)

    // Allow some margin: detection should be in the right 2/3 of the display
    const displayRightThreshold = 480 * 0.4; // 192
    expect(
      box.left >= displayRightThreshold,
      `crop box is in right side of image (left=${box.left} >= ${displayRightThreshold})`,
    );
  }

  await page.screenshot({ path: 'realistic-test.png' });
  console.log('  Screenshot: realistic-test.png');

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
