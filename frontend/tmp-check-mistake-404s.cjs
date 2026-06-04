const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failures = [];
  page.on('response', async (resp) => {
    const status = resp.status();
    if (status >= 400) failures.push(`${status} ${resp.url()}`);
  });
  await page.goto('http://127.0.0.1:3011/mistake', { waitUntil: 'networkidle' });
  console.log(JSON.stringify(failures, null, 2));
  await browser.close();
})();
