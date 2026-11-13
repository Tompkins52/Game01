// Drives the real game in a phone-sized browser: intro, dog pick, tilt, thumb pad, Zoomies,
// pause, results and saving. Needs the game served locally. Run:
//   node tests/browser.test.mjs http://127.0.0.1:8123/ [folder-for-screenshots]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:8123/';
const shots = process.argv[3] || '';
let failed = 0;
const check = (ok, msg) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + msg);
  if (!ok) failed++;
};
const shot = async (page, name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const errors = [];
const watch = (page, name) => {
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${name} ${m.type()}: ${m.text()}`);
  });
  page.on('requestfailed', (r) => errors.push(`${name} request failed: ${r.url()}`));
};

// ------------------------------------------------------------------ phone, 360 x 740
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
watch(page, 'phone');
await page.goto(base);
await page.waitForFunction(() => window.__ctc);
const dog = () => page.evaluate(() => {
  const d = window.__ctc.race.dogs[0];
  return { x: d.x, y: d.y, vx: d.vx, vy: d.vy, zoom: d.zoom, energy: d.energy };
});
const overflow = () => page.evaluate(() => {
  const s = document.querySelector('.screen:not([hidden])');
  return s ? s.scrollWidth - s.clientWidth : 0;
});

console.log('First run');
await shot(page, '01-title');
await page.click('#btn-play');
check(await page.isVisible('#scr-intro'), "first Play opens Sven's intro");
const lines = await page.evaluate(() => document.querySelectorAll('#intro-dots i').length);
check(lines === 12, 'intro has 12 lines');
for (let i = 0; i < lines; i++) {
  if (i === 1 || i === 3 || i === 8 || i === 9) {
    await page.waitForTimeout(i === 9 ? 2300 : 1600);
    await shot(page, `02-intro-${i + 1}`);
  }
  check((await page.textContent('#intro-text')).length > 10, `intro line ${i + 1} has text`);
  await page.click('#btn-intro-next');
}
check(await page.isVisible('#scr-dogs'), 'intro ends at the dog picker');
check((await page.locator('#dog-grid .dog').count()) === 8, 'eight dogs to pick from');
check((await overflow()) <= 0, 'dog picker does not scroll sideways');
await page.click('#dog-grid .dog[data-id="pitbull"]');
check((await page.textContent('#dog-card h3')) === 'Pit Bull', 'Pit Bull card shows');
await shot(page, '03-dogs');
await page.click('#btn-dog-go');
check(await page.isVisible('#scr-levels'), 'levels list opens');
check((await page.locator('.lvl').count()) === 20, 'twenty levels');
check((await page.locator('.lvl:not(.locked)').count()) === 1, 'only level 1 is open at first');
await shot(page, '04-levels');
await page.click('.lvl:not(.locked)');
check(await page.isVisible('#scr-brief'), 'briefing opens');
check(await page.isVisible('#brief-meet'), 'briefing introduces the first Bad Owner');
await shot(page, '05-brief');

console.log('Tilt steering');
await page.evaluate(() => {
  window.__tilt = { beta: 45, gamma: 0 };
  setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: window.__tilt.beta, gamma: window.__tilt.gamma })), 16);
});
await page.click('#ctl-tilt');
await page.click('#btn-start');
await page.waitForFunction(() => window.__ctc.screen === 'race' && window.__ctc.race.phase === 'run', null, { timeout: 15000 });
check(await page.evaluate(() => window.__ctc.input.mode === 'tilt' && window.__ctc.input.tilt.have), 'tilt sensor is in use');
let a = await dog();
await page.waitForTimeout(500);
let b = await dog();
check(Math.abs(b.y - a.y) < 3 && Math.abs(b.x - a.x) < 3, 'holding the phone in the starting spot means stay');
await page.evaluate(() => { window.__tilt.beta = 25; });
await page.waitForTimeout(900);
a = await dog();
check(a.vy > 200 && Math.abs(a.vx) < 40, `tip forward runs forward (vy ${Math.round(a.vy)})`);
await shot(page, '06-race-tilt');
await page.evaluate(() => { window.__tilt.gamma = 20; });
await page.waitForTimeout(500);
a = await dog();
check(a.vy > 150 && a.vx > 150, `forward and right goes forward and right (vx ${Math.round(a.vx)}, vy ${Math.round(a.vy)})`);
await page.evaluate(() => { window.__tilt.gamma = -20; });
await page.waitForTimeout(450);
a = await dog();
check(a.vy > 150 && a.vx < -150, `forward and left goes forward and left (vx ${Math.round(a.vx)}, vy ${Math.round(a.vy)})`);
await page.evaluate(() => { window.__tilt.beta = 45; window.__tilt.gamma = 0; });
await page.waitForTimeout(900);
a = await dog();
check(Math.hypot(a.vx, a.vy) < 25, 'back in the starting spot stops the dog');
await page.evaluate(() => { window.__tilt.beta = 66; });
await page.waitForTimeout(700);
a = await dog();
check(a.vy < -80, `tip back backs up (vy ${Math.round(a.vy)})`);
await page.evaluate(() => { window.__tilt.beta = 25; });
const e0 = (await dog()).energy;
await page.tap('#touch', { position: { x: 180, y: 300 } });
await page.waitForTimeout(200);
a = await dog();
check(a.zoom > 0 && a.energy < e0, 'tapping the screen in tilt mode fires Zoomies');
await shot(page, '07-zoomies');

console.log('Pause and thumb steering');
await page.click('#btn-pause');
check(await page.isVisible('#scr-pause'), 'pause menu shows');
const t0 = await page.evaluate(() => window.__ctc.race.t);
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__ctc.race.t)) === t0, 'the race clock stops while paused');
await shot(page, '08-pause');
await page.click('#p-pad');
await page.click('#btn-resume');
check(await page.evaluate(() => window.__ctc.input.mode === 'pad'), 'switched to thumb steering');
await page.waitForTimeout(600);
a = await dog();
check(Math.hypot(a.vx, a.vy) < 40, 'thumb mode ignores tilt');
await page.mouse.move(180, 520);
await page.mouse.down();
await page.mouse.move(180, 450, { steps: 4 });
await page.waitForTimeout(700);
a = await dog();
check(a.vy > 200, `dragging up runs forward (vy ${Math.round(a.vy)})`);
check(await page.evaluate(() => !document.getElementById('stick').hidden), 'the thumb stick shows under the finger');
await shot(page, '09-thumb');
await page.mouse.move(250, 520, { steps: 4 });
await page.waitForTimeout(600);
a = await dog();
check(a.vx > 150, `dragging right steers right (vx ${Math.round(a.vx)})`);
await page.mouse.up();
await page.waitForTimeout(700);
a = await dog();
check(Math.hypot(a.vx, a.vy) < 40, 'letting go stops the dog');

console.log('Finish and save');
await page.evaluate(() => { window.__ctc.race.dogs[0].control = 'ai'; });
await page.waitForFunction(() => window.__ctc.screen === 'results', null, { timeout: 90000 });
const total = Number((await page.textContent('#res-total')).replace(/,/g, ''));
check(total > 0, `results show a score (${total})`);
check((await overflow()) <= 0, 'results do not scroll sideways');
await shot(page, '10-results');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chase-the-cat.save.v1')));
check(saved && saved.dog === 'pitbull' && saved.seenIntro === true, 'dog choice and intro are saved');
check(saved.dogs.pitbull.love > 0, `Love was saved (${saved.dogs.pitbull.love})`);
const stars = (saved.levels[1] || {}).stars || 0;
check(stars >= 0 && saved.levels[1].best === total, 'best score saved for level 1');
await page.reload();
await page.waitForFunction(() => window.__ctc);
await page.click('#btn-play');
check(await page.isVisible('#scr-levels'), 'after a reload, Play goes straight to the levels');
check((await page.locator('.lvl:not(.locked)').count()) === (stars >= 1 ? 2 : 1), 'level 2 opens after a top 3 finish');
await page.click('#scr-levels [data-back]');
await page.click('#btn-settings');
check(await page.isVisible('#scr-settings'), 'settings open');
await page.click('#s-music');
check((await page.getAttribute('#s-music', 'aria-checked')) === 'false', 'music can be switched off');
await shot(page, '11-settings');
await ctx.close();

// ------------------------------------------------------------------ desktop, keyboard only
console.log('Desktop and keyboard');
const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const desk = await dctx.newPage();
watch(desk, 'desktop');
await desk.goto(base);
await desk.waitForFunction(() => window.__ctc);
const box = await desk.locator('#stage').boundingBox();
check(box.width < 520 && Math.abs(box.x + box.width / 2 - 640) < 2, 'on a wide screen the game sits in a centered phone-shaped column');
await desk.keyboard.press('Tab');
check((await desk.evaluate(() => document.activeElement.id)) === 'btn-play', 'Tab lands on Play first');
await desk.keyboard.press('Enter');
check(await desk.isVisible('#scr-intro'), 'Enter on Play opens the intro');
await desk.focus('#btn-intro-skip');
await desk.keyboard.press('Enter');
await desk.focus('#btn-dog-go');
await desk.keyboard.press('Enter');
await desk.focus('.lvl:not(.locked)');
await desk.keyboard.press('Enter');
await desk.focus('#btn-start');
await desk.keyboard.press('Enter');
await desk.waitForFunction(() => window.__ctc.screen === 'race' && window.__ctc.race.phase === 'run', null, { timeout: 15000 });
await desk.keyboard.down('ArrowUp');
await desk.waitForTimeout(900);
const dv = await desk.evaluate(() => window.__ctc.race.dogs[0].vy);
check(dv > 200, `arrow keys run the dog (vy ${Math.round(dv)})`);
await desk.keyboard.press('Space');
await desk.waitForTimeout(150);
check((await desk.evaluate(() => window.__ctc.race.dogs[0].zoom)) > 0, 'space bar fires Zoomies');
await desk.keyboard.up('ArrowUp');
await shot(desk, '12-desktop');
await desk.keyboard.press('Escape');
check(await desk.isVisible('#scr-pause'), 'Escape pauses');
await dctx.close();

check(errors.length === 0, 'no console errors or warnings' + (errors.length ? ':\n' + [...new Set(errors)].join('\n') : ''));
await browser.close();
console.log(failed ? `BROWSER TEST FAILED (${failed})` : 'Browser test passed.');
process.exit(failed ? 1 : 0);
