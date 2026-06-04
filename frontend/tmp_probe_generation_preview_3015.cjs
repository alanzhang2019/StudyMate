const fs = require('fs');
const { chromium } = require('@playwright/test');

const settingsStorage = JSON.stringify({
  state: {
    modelId: 'gpt-4o',
    providerId: 'openai',
    providersConfig: {
      openai: { apiKey: 'test-key' },
    },
    agentMode: 'preset',
    selectedAgentIds: [],
    ttsEnabled: false,
    reviewOutlineEnabled: false,
    autoConfigApplied: true,
  },
  version: 2,
});

const generationSession = JSON.stringify({
  sessionId: 'mistake-probe-session',
  requirements: {
    requirement: '讲解一道四年级数学错题：36 + 27 = ?，学生答案 53，正确答案 63。',
    webSearch: false,
    interactiveMode: false,
  },
  pdfText: '',
  sceneOutlines: [],
  currentStep: 'generating',
  previewPhase: 'preparing',
  sourceMode: 'mistake',
  mistakeSessionId: 'mistake-probe-session',
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const events = [];
  const responses = [];

  page.on('console', (msg) => events.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => events.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) =>
    events.push(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`),
  );
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('/classroom/')) {
      responses.push({
        url,
        status: response.status(),
      });
    }
  });

  await page.addInitScript(
    ({ settings, session }) => {
      localStorage.setItem('settings-storage', settings);
      sessionStorage.setItem('generationSession', session);
    },
    { settings: settingsStorage, session: generationSession },
  );

  try {
    await page.goto('http://127.0.0.1:3015/generation-preview', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(8000);
    const snapshot = {
      url: page.url(),
      title: await page.title(),
      text: (await page.locator('body').innerText()).slice(0, 3000),
      events,
      responses,
    };
    fs.writeFileSync(
      'D:/AItrade/ai-math-mistake-machine/generation-preview-3015-probe.json',
      JSON.stringify(snapshot, null, 2),
    );
    await page.screenshot({
      path: 'D:/AItrade/ai-math-mistake-machine/generation-preview-3015-probe.png',
      fullPage: true,
    });
    console.log(JSON.stringify(snapshot, null, 2));
  } finally {
    await browser.close();
  }
})();
