const fs = require('fs');
const { chromium } = require('@playwright/test');
const resultPath = 'D:/AItrade/AI-MATH-MISTAKE/tmp-verify-generation-preview-3013.result.json';

(async () => {
  fs.writeFileSync(resultPath, JSON.stringify({ started: true }, null, 2));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const events = [];

  page.on('console', (msg) => events.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => events.push(`[pageerror] ${err.message}`));
  page.on('close', () => events.push('[page] closed'));
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      events.push(`[nav] ${frame.url()}`);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      'settings-storage',
      JSON.stringify({
        state: {
          providerId: 'kimi',
          modelId: '',
          autoConfigApplied: true,
          agentMode: 'preset',
        },
        version: 2,
      }),
    );

    sessionStorage.setItem(
      'generationSession',
      JSON.stringify({
        sessionId: 'mistake-session-verify',
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
        mistakeSessionId: 'mistake-session-verify',
      }),
    );
  });

  await page.goto('http://127.0.0.1:3013/generation-preview', { waitUntil: 'networkidle' });

  let outcome = 'timeout';
  try {
    await page.waitForFunction(
      () => {
        const bodyText = document.body?.innerText || '';
        return (
          window.location.pathname.startsWith('/classroom/') ||
          bodyText.includes('LLM returned empty response') ||
          bodyText.includes('Generation failed') ||
          bodyText.includes('生成失败')
        );
      },
      { timeout: 120000 },
    );

    const bodyText = await page.locator('body').innerText();
    if (page.url().includes('/classroom/')) {
      outcome = 'classroom';
    } else if (
      bodyText.includes('LLM returned empty response') ||
      bodyText.includes('Generation failed') ||
      bodyText.includes('生成失败')
    ) {
      outcome = 'error';
    }
  } catch (error) {
    events.push(`[script-error] ${error instanceof Error ? error.message : String(error)}`);
  }

  const bodyText = page.isClosed() ? '' : await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(
    resultPath,
    JSON.stringify(
      {
        outcome,
        url: page.url(),
        bodySnippet: bodyText.slice(0, 2000),
        events,
      },
      null,
      2,
    ),
  );

  await browser.close();
})()
  .then(() => {
    console.log('verification-script:done');
  })
  .catch((error) => {
    console.error('verification-script:error', error);
    process.exit(1);
  });
