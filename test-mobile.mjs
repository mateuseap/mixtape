import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

page.on('pageerror', err => console.log(`  error: ${err.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

if (await page.locator('.track-card').count() > 0) {
  await page.locator('.track-card').first().click();
  await page.waitForTimeout(2000);
}

await page.evaluate(() => {
  document.getElementById('device-canvas').scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(500);

function tapPos(box, pctY, pctX = 0.5) {
  return { x: box.x + box.width * pctX, y: box.y + box.height * pctY };
}

let ok = 0, fail = 0;

async function testTap(label, pos, doReset = false) {
  if (doReset) {
    await page.locator('#reset-view').click();
    await page.waitForTimeout(80);
  }

  let l = await page.locator('#pb-play').getAttribute('aria-label');
  if (l === 'Pause') {
    await page.locator('#pb-play').click();
    await page.waitForTimeout(200);
  }
  l = await page.locator('#pb-play').getAttribute('aria-label');
  if (l !== 'Play') {
    await page.locator('#pb-play').click();
    await page.waitForTimeout(200);
  }

  await page.touchscreen.tap(pos.x, pos.y);
  await page.waitForTimeout(800);

  const after = await page.locator('#pb-play').getAttribute('aria-label');
  const hit = after === 'Pause';
  if (hit) ok++; else fail++;
  console.log(`  ${hit ? 'OK' : 'MISS'} ${label} (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}) => ${after}`);
  return hit;
}

// MP3: tuned for auto-rotation drift that accumulates during page load + waits
console.log('\n=== MP3 Player (no rotation reset — matches auto-rotated angle) ===');
const box = await page.locator('#device-canvas').boundingBox();
console.log(`Canvas: ${box.width.toFixed(0)}x${box.height.toFixed(0)} at (${box.x.toFixed(0)}, ${box.y.toFixed(0)})`);

const mp3Positions = [
  { label: '50%', pos: tapPos(box, 0.50) },
  { label: '55%', pos: tapPos(box, 0.55) },
  { label: '60%', pos: tapPos(box, 0.60) },
  { label: '65%', pos: tapPos(box, 0.65) },
  { label: '70%', pos: tapPos(box, 0.70) },
  { label: '75%', pos: tapPos(box, 0.75) },
];

for (const t of mp3Positions) {
  if (await testTap(t.label, t.pos)) break;
}

// CD: always reset rotation before each tap to keep positions consistent
console.log('\n=== CD Player (rotation reset before each tap) ===');
let l = await page.locator('#pb-play').getAttribute('aria-label');
if (l === 'Pause') {
  await page.locator('#pb-play').click();
  await page.waitForTimeout(200);
}
await page.locator('#device-cd').click();
await page.waitForTimeout(1500);

await page.evaluate(() => {
  document.getElementById('device-canvas').scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(500);

const cdBox = await page.locator('#device-canvas').boundingBox();
console.log(`Canvas: ${cdBox.width.toFixed(0)}x${cdBox.height.toFixed(0)} at (${cdBox.x.toFixed(0)}, ${cdBox.y.toFixed(0)})`);

const cdPositions = [
  { label: 'cd 67%/41%X', pos: tapPos(cdBox, 0.67, 0.41) },
  { label: 'cd 68%/39%X', pos: tapPos(cdBox, 0.68, 0.39) },
  { label: 'cd 68%/41%X', pos: tapPos(cdBox, 0.68, 0.41) },
  { label: 'cd 68%/43%X', pos: tapPos(cdBox, 0.68, 0.43) },
  { label: 'cd 69%/40%X', pos: tapPos(cdBox, 0.69, 0.40) },
  { label: 'cd 69%/41%X', pos: tapPos(cdBox, 0.69, 0.41) },
  { label: 'cd 69%/42%X', pos: tapPos(cdBox, 0.69, 0.42) },
  { label: 'cd 70%/41%X', pos: tapPos(cdBox, 0.70, 0.41) },
];

for (const t of cdPositions) {
  if (await testTap(t.label, t.pos, true)) break;
}

console.log(`\n=== Results: ${ok} hits, ${fail} misses ===`);
await browser.close();
