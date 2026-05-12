const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', request => { console.log('FAILED URL:', request.url(), request.failure().errorText); });
  
  await page.goto('http://localhost:5173/index.html?carousel=true', { waitUntil: 'networkidle0' });
  
  const headerBtnVisible = await page.evaluate(() => {
    const btn = document.getElementById('header-carousel-next');
    return btn ? window.getComputedStyle(btn).display : 'missing';
  });
  
  console.log('LightningWords Header Button Display (Vite):', headerBtnVisible);
  
  await browser.close();
})();

