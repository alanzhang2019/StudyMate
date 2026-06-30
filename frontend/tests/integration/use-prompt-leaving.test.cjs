// Integration test for usePromptLeaving hook.
// Verifies that the hook attaches beforeunload + popstate listeners
// when active, and removes them when inactive.
//
// Usage: node tests/integration/use-prompt-leaving.test.cjs
// Requires: frontend dev server running at http://localhost:3000 (or set BASE_URL)

const { chromium } = require('d:/AItrade/ai-math-mistake-machine/frontend/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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

  // Test 1: /mistake (home) — should NOT have prompt leaving active
  console.log('Test 1: /mistake — no active session, no prompt guard');
  await page.goto(`${BASE_URL}/mistake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const homeState = await page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(e, 'returnValue', { writable: true, value: undefined });
    window.dispatchEvent(e);
    return { defaultPrevented: e.defaultPrevented, returnValue: e.returnValue };
  });
  expect(!homeState.defaultPrevented, 'beforeunload NOT prevented on /mistake');

  // Test 2: navigate to /generation-preview with mock session in localStorage
  console.log('\nTest 2: /generation-preview with active session — prompt guard active');
  await page.goto(`${BASE_URL}/mistake`, { waitUntil: 'domcontentloaded' });

  // Inject a session in progress
  await page.evaluate(() => {
    const session = {
      sessionId: 'test-session',
      requirements: {},
      pdfText: '',
      currentStep: 'generating',
      previewPhase: 'generating-content',
    };
    localStorage.setItem('generationSession', JSON.stringify(session));
    sessionStorage.setItem('generationSession', JSON.stringify(session));
  });

  await page.goto(`${BASE_URL}/generation-preview`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const genState = await page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(e, 'returnValue', { writable: true, value: undefined });
    window.dispatchEvent(e);
    return { defaultPrevented: e.defaultPrevented, returnValue: e.returnValue };
  });
  expect(genState.defaultPrevented, 'beforeunload IS prevented on /generation-preview with active session');
  expect(typeof genState.returnValue === 'string' && genState.returnValue.length > 0, 'beforeunload returnValue is a non-empty string');

  // Test 3: confirm popstate handler is attached
  console.log('\nTest 3: popstate guard on /generation-preview');
  const popstateResult = await page.evaluate(() => {
    const before = history.state;
    const guard = before && before.__promptGuard === true;
    return { hasGuard: !!guard, stateKeys: before ? Object.keys(before) : [] };
  });
  expect(popstateResult.hasGuard, 'history pushState guard present after page load');

  // Test 4: storage is persisted
  console.log('\nTest 4: session persists across page transitions');
  const persisted = await page.evaluate(() => !!sessionStorage.getItem('generationSession'));
  expect(persisted, 'sessionStorage contains generationSession');

  // Test 5: navigate away and come back — banner appears on /mistake
  console.log('\nTest 5: returning to /mistake shows resume banner');
  await page.goto(`${BASE_URL}/mistake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const banner = await page.$('[data-testid="resume-banner"]');
  expect(!!banner, 'ResumeBanner is rendered on /mistake when active session exists');

  // Cleanup
  await page.evaluate(() => {
    localStorage.removeItem('generationSession');
    sessionStorage.removeItem('generationSession');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
