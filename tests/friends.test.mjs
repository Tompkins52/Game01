// Two browsers join one pack and race each other. Needs a local web server for the game and a
// local PeerJS server (see docs/admin-notes.md). Run:
//   node tests/friends.test.mjs http://127.0.0.1:8123/ 127.0.0.1:9000
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:8123/';
const peer = process.argv[3] || '127.0.0.1:9000';
const shots = process.argv[4] || '';
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1; };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--allow-loopback-in-peer-connection', '--disable-features=WebRtcHideLocalIpsWithMdns']
});
const errors = [];
async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  return page;
}
const A = await player('host'), B = await player('guest');

await A.goto(`${base}?peer=${peer}`);
await A.waitForFunction(() => window.__ctc);
await A.click('#btn-friends');
await A.click('#btn-host');
await A.waitForSelector('#fr-lobby:not([hidden])', { timeout: 15000 });
const code = (await A.textContent('#lobby-code')).trim();
console.log('pack code', code);
if (!/^[A-Z]{4}$/.test(code)) fail('bad pack code');

await B.goto(`${base}?peer=${peer}&pack=${code}`);
await B.waitForFunction(() => window.__ctc);
await B.evaluate(() => { window.__ctc.save.dog = 'corgi'; });
await B.click('#join-form button[type=submit]');
await B.waitForSelector('#fr-lobby:not([hidden])', { timeout: 20000 });
await A.waitForFunction(() => document.querySelectorAll('#lobby-list canvas').length === 2, null, { timeout: 10000 });
const guestSees = await B.evaluate(() => document.querySelectorAll('#lobby-list canvas').length);
if (guestSees !== 2) fail('guest lobby should show 2 players, shows ' + guestSees);
if (shots) { await A.screenshot({ path: shots + '/lobby-host.png' }); await B.screenshot({ path: shots + '/lobby-guest.png' }); }

await A.click('#btn-lobby-go');
for (const p of [A, B]) await p.waitForFunction(() => window.__ctc.screen === 'race' && window.__ctc.race, null, { timeout: 10000 });
// both run forward
for (const p of [A, B]) await p.evaluate(() => { window.__ctc.input.keys.arrowup = true; });
await A.waitForTimeout(7000);
const snap = (p) => p.evaluate(() => window.__ctc.race.dogs.map((d) => ({ slot: d.slot, control: d.control, y: Math.round(d.y), id: d.id })));
const sa = await snap(A), sb = await snap(B);
console.log('host sees ', JSON.stringify(sa));
console.log('guest sees', JSON.stringify(sb));
if (sa[1].control !== 'remote' || sa[1].y < 600) fail('host does not see the guest dog moving');
if (sb[0].control !== 'remote' || sb[0].y < 600) fail('guest does not see the host dog moving');
if (sb[2].y < 400 || sb[3].y < 400) fail('guest does not see the computer dogs moving');
if (Math.abs(sa[1].y - sb[1].y) > 260) fail('guest dog position is far apart on the two screens');
if (sa[2].id !== sb[2].id || sa[3].id !== sb[3].id) fail('computer dogs differ between screens');
if (shots) { await A.screenshot({ path: shots + '/race-host.png' }); await B.screenshot({ path: shots + '/race-guest.png' }); }

for (const p of [A, B]) await p.waitForFunction(() => window.__ctc.screen === 'results', null, { timeout: 120000 });
const res = (p) => p.evaluate(() => [...document.querySelectorAll('#res-pack div')].map((r) => r.textContent));
const ra = await res(A), rb = await res(B);
console.log('host results ', JSON.stringify(ra));
console.log('guest results', JSON.stringify(rb));
if (ra.length !== 4 || rb.length !== 4) fail('results should list 4 dogs');
const norm = (rows) => rows.map((r) => r.replace(/You|Player \d/g, 'P').replace(/\s+/g, ' '));
if (JSON.stringify(norm(ra).map((r) => r.split(' ').slice(-2))) !== JSON.stringify(norm(rb).map((r) => r.split(' ').slice(-2)))) fail('times and scores differ between screens');
// what one dog ate or picked up is gone on the other phone too
const world = (p) => p.evaluate(() => {
  const t = window.__ctc.race.track;
  return { eaten: t.villains.filter((v) => !v.alive).map((v) => v.id).sort(), bones: t.bones.filter((b) => b.taken).map((b) => b.id).sort() };
});
const wa = await world(A), wb = await world(B);
console.log('eaten on host', JSON.stringify(wa.eaten), 'on guest', JSON.stringify(wb.eaten), 'bones', wa.bones.length, wb.bones.length);
if (JSON.stringify(wa.eaten) !== JSON.stringify(wb.eaten)) fail('Bad Owners eaten differ between screens');
if (wa.bones.length < 5 || JSON.stringify(wa.bones) !== JSON.stringify(wb.bones)) fail('bones picked up differ between screens');
if (shots) { await A.screenshot({ path: shots + '/results-host.png' }); await B.screenshot({ path: shots + '/results-guest.png' }); }

// rematch: back to the pack, host starts again
await A.click('#btn-retry');
await B.click('#btn-retry');
await A.waitForSelector('#fr-lobby:not([hidden])');
await A.click('#btn-lobby-go');
for (const p of [A, B]) await p.waitForFunction(() => window.__ctc.screen === 'race', null, { timeout: 10000 });
console.log('rematch started');
// guest leaves mid-race: host keeps racing
await B.close();
await A.waitForFunction(() => window.__ctc.race.dogs[1].left === true, null, { timeout: 15000 });
console.log('host saw the guest leave');

if (errors.length) fail('console errors:\n' + errors.join('\n'));
await browser.close();
console.log(process.exitCode ? 'FRIENDS TEST FAILED' : 'Friends test passed.');
