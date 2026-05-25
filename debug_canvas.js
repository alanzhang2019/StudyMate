const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3013/classroom/PoehaXhF7Q', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(5000);
  const data = await page.evaluate(() => {
    const stage = document.querySelector('.aspect-\\[16\\/9\\]');
    const contentLayer = stage ? stage.querySelector('.origin-top-left') : null;
    return {
      stageExists: !!stage,
      contentStyle: contentLayer ? contentLayer.getAttribute('style') : null,
      outerHTML: stage ? stage.outerHTML.substring(0, 500) : null
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
