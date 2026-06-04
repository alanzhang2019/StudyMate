const { chromium } = require('D:/AItrade/AI-MATH-MISTAKE/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => errors.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));
  await page.goto('http://127.0.0.1:3011/mistake', { waitUntil: 'networkidle' });
  const before = await page.locator('button').isDisabled();
  await page.setInputFiles('input[type="file"]', 'D:/AItrade/AI-MATH-MISTAKE/public/logos/kimi.png');
  await page.waitForTimeout(1000);
  const after = await page.locator('button').isDisabled();
  const previewCount = await page.locator('img[alt="待识别题目预览"]').count();
  console.log(JSON.stringify({ before, after, previewCount, errors }, null, 2));
  await browser.close();
})();
