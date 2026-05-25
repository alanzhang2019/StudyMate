const fs = require('fs');
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let capturedModel = null;
  let capturedApiKey = null;

  await page.addInitScript(() => {
    localStorage.setItem(
      'settings-storage',
      JSON.stringify({
        state: {
          providerId: 'kimi',
          modelId: '',
          autoConfigApplied: true,
        },
        version: 2,
      }),
    );
    sessionStorage.setItem(
      'generationSession',
      JSON.stringify({
        sessionId: 'mistake-session-1',
        requirements: {
          requirement: '请围绕这道小学数学错题生成讲解：36+27=?, 学生答案53，正确答案63。',
          webSearch: false,
          interactiveMode: false,
        },
        pdfText: '',
        sceneOutlines: [],
        currentStep: 'generating',
        previewPhase: 'preparing',
        sourceMode: 'mistake',
        mistakeSessionId: 'mistake-session-1',
      }),
    );
  });

  await page.route('**/api/generate/scene-outlines-stream', async (route) => {
    const headers = route.request().headers();
    capturedModel = headers['x-model'] || null;
    capturedApiKey = headers['x-api-key'] ? 'present' : 'missing';
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"type":"error","error":"stop after capture"}\n\n',
    });
  });

  await page.goto('http://127.0.0.1:3013/generation-preview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const settingsRaw = await page.evaluate(() => localStorage.getItem('settings-storage'));
  fs.writeFileSync(
    'D:/AItrade/ai-math-mistake-machine/kimi-model-recovery-check.json',
    JSON.stringify({ capturedModel, capturedApiKey, settingsRaw }, null, 2),
  );
  await browser.close();
})();
