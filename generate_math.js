const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <div style="width: 400px; height: 200px; background: white; color: black; font-family: sans-serif; font-size: 30px; padding: 20px;">
      Solve for x:<br><br>
      2x + 5 = 15
    </div>
  `);
  await page.locator('div').screenshot({ path: 'math_problem.png' });
  await browser.close();
  console.log('math_problem.png generated.');
})();
