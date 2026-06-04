const fs = require('fs');
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const events = [];
  const responses = [];
  let extractSeen = false;

  page.on('console', (msg) => events.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => events.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) =>
    events.push(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`),
  );
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/mistake/session/extract')) {
      extractSeen = true;
      responses.push({
        url,
        status: response.status(),
        body: await response.text().catch(() => '<unreadable>'),
      });
    }
  });

  try {
    await page.goto('http://127.0.0.1:3015/mistake', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({
      path: 'D:/AItrade/ai-math-mistake-machine/mistake-3015-before-upload.png',
      fullPage: true,
    });
    await page.setInputFiles('input[type="file"]', 'D:/AItrade/AI-MATH-MISTAKE/public/logos/kimi.png');
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/mistake/session/extract'), {
        timeout: 20000,
      }),
      page.getByRole('button', { name: '拍照识题' }).click(),
    ]).catch(() => {});
    await page.waitForTimeout(extractSeen ? 3000 : 15000);
    await page.screenshot({
      path: 'D:/AItrade/ai-math-mistake-machine/mistake-3015-after-extract.png',
      fullPage: true,
    });

    const startButton = page.getByRole('button', { name: '开始讲解' });
    if (await startButton.count()) {
      await startButton.click();
      await page.waitForTimeout(15000);
    } else {
      await page.waitForTimeout(15000);
    }

    const snapshot = {
      url: page.url(),
      title: await page.title(),
      text: (await page.locator('body').innerText()).slice(0, 2000),
      html: (await page.locator('body').innerHTML()).slice(0, 4000),
      events,
      responses,
    };
    await page.screenshot({
      path: 'D:/AItrade/ai-math-mistake-machine/mistake-3015-after-flow.png',
      fullPage: true,
    });
    fs.writeFileSync(
      'D:/AItrade/ai-math-mistake-machine/follow-mistake-flow-3015.json',
      JSON.stringify(snapshot, null, 2),
    );
    console.log(JSON.stringify(snapshot, null, 2));
  } finally {
    await browser.close();
  }
})();
