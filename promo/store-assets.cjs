// Renders Chrome Web Store images into docs/store/ (JPEG = no alpha channel, as the store requires).
// NODE_PATH=<dir with playwright-core> node promo/store-assets.cjs
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const out = path.join(__dirname, '..', 'docs', 'store');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto('file://' + path.join(__dirname, 'store-assets.html'));
  await page.evaluate(() => window.ready);

  const names = { shot1: 'screenshot-1', shot2: 'screenshot-2', shot3: 'screenshot-3', shot4: 'screenshot-4', shot5: 'screenshot-5', small: 'small-promo-tile-440x280', marquee: 'marquee-promo-tile-1400x560' };
  for (const [id, name] of Object.entries(names)) {
    await page.locator('#' + id).screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 95 });
    console.log('wrote docs/store/' + name + '.jpg');
  }
  await browser.close();
})();
