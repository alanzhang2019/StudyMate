const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  context.setDefaultTimeout(60000);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  // Mock API routes to avoid LLM errors
  await page.route('**/api/generate/scene-outlines-stream', route => {
    const outlines = [
      { order: 1, title: 'Scene 1', description: 'Desc 1', visualStyle: 'visual', visualConcept: 'concept' }
    ];
    const events = `data: ${JSON.stringify({ type: 'outline', data: outlines[0], index: 0 })}\n\n` +
                   `data: ${JSON.stringify({ type: 'done', outlines })}\n\n`;
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      body: events
    });
  });

  await page.route('**/api/generate/agent-profiles', route => {
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        agents: [{ id: 'mock-agent', name: 'Agent', role: 'teacher', persona: 'helpful', avatar: '/avatars/teacher.png', color: 'blue', priority: 1 }]
      })
    });
  });

  await page.route('**/api/generate/scene-content', route => {
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, content: 'Some mock content' })
    });
  });

  await page.route('**/api/generate/scene-actions', async route => {
    let id = 'test-stage';
    try {
      const body = route.request().postDataJSON();
      if (body && body.stageId) id = body.stageId;
    } catch (e) {}
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        scene: {
          id: 'scene-1',
          stageId: id,
          order: 1,
          actions: [
            { type: 'speech', content: { text: 'Hello', audioId: 'audio-1' } },
            { type: 'element_add', content: { element: { id: 'el-1', type: 'text', content: 'Math', geometry: { x: 10, y: 10, w: 100, h: 50, z: 1 } } } }
          ],
          cameraMovements: [],
          status: 'completed',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      })
    });
  });
  
  await page.route('**/api/generate/tts', route => {
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, base64: 'UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', format: 'wav' }) // minimal valid wav base64
    });
  });

  await page.route('**/api/mistake/session/*', route => {
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, session: { id: 'mock-session-id', status: 'completed' } })
    });
  });

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log('<<', response.status(), response.url());
    }
  });

  try {
    console.log('Navigating to home to set origin...');
    await page.goto('http://localhost:3013/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Injecting mock generationSession into sessionStorage and settings into localStorage...');
    await page.evaluate(() => {
      const mockSession = {
        sessionId: 'mock-session-id',
        requirements: {
          requirement: '讲解这道错题：已知长方形面积是24，长是6，求宽是多少？请用生动的方式讲解。',
          webSearch: false,
          interactiveMode: false,
        },
        pdfText: '',
        sceneOutlines: [],
        currentStep: 'generating',
        previewPhase: 'preparing',
        sourceMode: 'mistake',
        mistakeSessionId: 'mock-session-id',
      };
      sessionStorage.setItem('generationSession', JSON.stringify(mockSession));
      
      const mockSettings = {
        state: {
          modelId: 'mock-model',
          providerId: 'mock-provider',
          providersConfig: {
            'mock-provider': { apiKey: 'test-key', baseUrl: 'http://localhost:3016/api/mock' },
          },
          agentMode: 'auto',
          selectedAgentIds: [],
          ttsEnabled: false,
          reviewOutlineEnabled: false,
          autoConfigApplied: true,
        },
        version: 2,
      };
      localStorage.setItem('settings-storage', JSON.stringify(mockSettings));
    });

    console.log('Navigating directly to /generation-preview...');
    await page.goto('http://localhost:3013/generation-preview', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Waiting for navigation to classroom...');
    let urlWaitInterval;
    try {
      urlWaitInterval = setInterval(async () => {
        try {
          await page.screenshot({ path: 'classroom-test-mid.png' });
          const html = await page.content();
          require('fs').writeFileSync('classroom-test-mid.html', html);
          console.log('Took mid screenshot. URL is:', page.url());
        } catch (e) {
          console.log('Mid screenshot failed:', e.message);
        }
      }, 5000);

      await page.waitForURL('**/classroom/**', { timeout: 60000 });
    } finally {
      if (urlWaitInterval) clearInterval(urlWaitInterval);
    }
    
    console.log('Navigated to classroom: ' + page.url());
    
    console.log('Checking for transform scale bugs in classroom...');
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      const transformScale = await page.evaluate(() => {
        const elements = document.querySelectorAll('div');

        for (const el of elements) {
          if (el.style.transform && el.style.transform.includes('scale')) {
            return {
              className: el.className,
              id: el.id,
              transform: el.style.transform
            };
          }
        }
        return 'No element with scale found';
      });
      const canvasSize = await page.evaluate(() => {
        const canvas = document.querySelector('.group\\/canvas');
        if (!canvas) return 'Canvas not found';
        const rect = canvas.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      console.log(`Check ${i}: Found transform:`, transformScale, 'Canvas size:', canvasSize);
    }

    
    await page.screenshot({ path: 'classroom-test-result.png' });
    console.log('Screenshot saved to classroom-test-result.png');
  } catch (err) {
    console.error('Error in script:', err);
    try {
      await page.screenshot({ path: 'classroom-test-error.png' });
    } catch (e) {
      console.error('Could not take screenshot, page might have crashed:', e);
    }
  } finally {
    await browser.close();
  }
})();
