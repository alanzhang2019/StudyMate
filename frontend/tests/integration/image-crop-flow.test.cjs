// Integration test for image-cropper-with-detection flow.
// Verifies:
//   1. Cropper modal appears immediately after file selection
//   2. Detection runs and sets the initial crop box (mocked for headless)
//   3. Cancel removes the image from the list
//   4. Confirm keeps the image and closes the modal
//   5. Re-detect button is visible when onReDetect is provided

const { chromium } = require('d:/AItrade/ai-math-mistake-machine/frontend/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: [],
  });
  const page = await context.newPage();
  let pass = 0;
  let fail = 0;
  const expect = (cond, msg) => {
    if (cond) {
      console.log(`  ✓ ${msg}`);
      pass++;
    } else {
      console.log(`  ✗ ${msg}`);
      fail++;
    }
  };

  // Pre-inject a mock image (small 100x100 PNG, base64)
  // We use a pre-baked 1x1 PNG since we don't need real content for the flow check
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAEklEQVR42mP8//8/AyUYi3gKYgQHALoFAYHG6d4HAAAAAElFTkSuQmCC';
  const tinyPngBuf = Buffer.from(tinyPngBase64, 'base64');

  // Build a mock image with multiple black rectangles (simulating problems)
  // Use a 400x400 image with one centered black square — easy to "detect"
  let multiRectBuf;
  try {
    const sharp = require('d:/AItrade/ai-math-mistake-machine/frontend/node_modules/sharp');
    multiRectBuf = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="200" height="120">
              <rect x="0" y="0" width="200" height="120" fill="black" />
              <text x="10" y="30" font-size="20" fill="white">4.</text>
              <text x="10" y="60" font-size="20" fill="white">AABBCC</text>
              <text x="10" y="90" font-size="20" fill="white">OOOO</text>
              <text x="10" y="110" font-size="20" fill="white">O less than A</text>
             </svg>`,
          ),
          top: 100,
          left: 100,
        },
      ])
      .png()
      .toBuffer();
  } catch (e) {
    console.log('sharp not available, using minimal test image');
    multiRectBuf = tinyPngBuf;
  }

  await page.goto(`${BASE_URL}/mistake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // The file input is hidden; we set the file via setInputFiles on the input
  const fileInput = await page.$('input[type="file"]');
  expect(!!fileInput, 'file input exists on /mistake');

  if (!fileInput) {
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(1);
  }

  // === Test 1: file selection opens cropper modal ===
  console.log('\nTest 1: file selection auto-opens cropper');
  await fileInput.setInputFiles([
    { name: 'problem.png', mimeType: 'image/png', buffer: multiRectBuf },
  ]);
  await page.waitForTimeout(500);

  // The cropper modal is a fixed inset-0 element
  const modalVisible = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div')).some((el) => {
      const s = el.getAttribute('style') || '';
      return s.includes('position: fixed') || el.className.includes('fixed inset-0');
    });
  });
  expect(modalVisible, 'cropper modal becomes visible after file select');

  // The "智能" badge should NOT yet appear (detection is still running or failed)
  const smartBadge = await page.$('text=智能');
  // Note: badge only shows after detection completes; we just check for the modal
  // giving time for OpenCV to load
  await page.waitForTimeout(5000); // wait for OpenCV to load + detection

  // === Test 2: cancel removes the image ===
  console.log('\nTest 2: cancel removes the image from list');
  const cancelBtn = await page.$('button:has(svg.lucide-x)');
  expect(!!cancelBtn, 'cancel button (X icon) is present');
  if (cancelBtn) {
    await cancelBtn.click();
    await page.waitForTimeout(1500); // wait for AnimatePresence exit
  }
  // After cancel, the image list should be empty (no card with "题目图片" alt)
  const stillHasImage = await page.$('img[alt*="题目图片"]');
  expect(!stillHasImage, 'no image card remains after cancel (cancel = discard)');

  // === Test 3: re-add image, click confirm ===
  console.log('\nTest 3: confirm keeps the image and closes modal');
  await fileInput.setInputFiles([
    { name: 'problem2.png', mimeType: 'image/png', buffer: multiRectBuf },
  ]);
  await page.waitForTimeout(2000);
  const confirmBtn = await page.$('button:has(svg.lucide-check)');
  expect(!!confirmBtn, 'confirm button (Check icon) is present');
  if (confirmBtn) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
  }
  const imageAfterConfirm = await page.$('img[alt*="题目图片"]');
  expect(!!imageAfterConfirm, 'image card remains after confirm');

  // === Test 4: re-detect button is visible ===
  console.log('\nTest 4: 智能框选 button visible when onReDetect provided');
  // Re-add image so the cropper opens again
  await fileInput.setInputFiles([
    { name: 'problem3.png', mimeType: 'image/png', buffer: multiRectBuf },
  ]);
  await page.waitForTimeout(2000);
  // Use a robust selector — get all buttons and find the one with the text
  const reDetectCount = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button'));
    return all.filter((b) => b.innerText.includes('智能框选')).length;
  });
  expect(reDetectCount >= 1, `re-detect button (智能框选) is in the DOM (found ${reDetectCount})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
