const fs = require('fs');
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const events = [];
  page.on('console', msg => events.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => events.push(`[pageerror] ${err.message}`));
  await page.goto('http://127.0.0.1:3012/mistake', { waitUntil: 'networkidle' });
  await page.setInputFiles('input[type="file"]', 'D:/AItrade/AI-MATH-MISTAKE/public/logos/kimi.png');
  await page.getByRole('button', { name: '拍照识题' }).click();
  await page.waitForTimeout(2000);
  const hasStart = await page.getByRole('button', { name: '开始讲解' }).count();
  if (hasStart) {
    await page.getByRole('button', { name: '开始讲解' }).click();
    await page.waitForTimeout(3000);
  }
  fs.writeFileSync('D:/AItrade/ai-math-mistake-machine/follow-mistake-flow-3012.json', JSON.stringify({ url: page.url(), hasStart, events }, null, 2));
  await browser.close();
})();
