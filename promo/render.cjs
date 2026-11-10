// Renders promo.html frame-by-frame to an MP4.
// Needs playwright-core and Google Chrome:  NODE_PATH=<dir with playwright-core> node promo/render.cjs out.mp4
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const out = process.argv[2] || 'dist/promo.mp4';
  const FPS = 30;
  const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu'] }); // GPU raster repeats tiles in zoomed frames
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'promo.html') + '?render');
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.DURATION);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

  const frames = duration * FPS;
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }));
    if (f % 300 === 0) process.stdout.write(`${f}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('wrote', out);
})();
