// Chase the Cat: screens, saving, and the loop that runs a race.

import { buildTrack, blend } from './track.js';
import { Race, DT, levelForLove, loveForLevel, rankTitle } from './sim.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Intro } from './intro.js';
import * as A from './art.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const ORD = ['1st', '2nd', '3rd', '4th'];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const SAVE_KEY = 'chase-the-cat.save.v1';

let rules, dogList, dogDefs, slotColors, villains, levelData, story;
let race = null, renderer, input, intro, net = null;
let screen = 'title', running = false, paused = false, acc = 0, last = 0;
let current = null; // { level, localSlot, friends }
let endTimer = -1, waiting = false, lobbyPick = false;
const sound = new Sound();
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
// Inside an embedded preview the phone's motion sensors and phone-to-phone links are switched off.
let framed = false;
try {
  framed = window.top !== window;
} catch (e) {
  framed = true;
}

// ------------------------------------------------------------------ save
const save = {
  dog: null, dogs: {}, levels: {}, seenIntro: false, attempts: 0,
  settings: { control: coarse && !framed ? 'tilt' : 'pad', sens: 22, sfx: true, music: true, buzz: true }
};
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    Object.assign(save, s, { settings: Object.assign(save.settings, s.settings || {}) });
  } catch (e) { /* private mode or blocked storage: play without saving */ }
}
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) { /* nothing to do */ }
}
const dogSave = (id) => save.dogs[id] || (save.dogs[id] = { love: 0 });
const dogLevel = (id) => levelForLove(dogSave(id).love, rules);
const unlocked = (id) => id === 1 || qs.has('all') || ((save.levels[id - 1] || {}).stars || 0) >= 1;
const worldOf = (level) => levelData.worlds.find((w) => w.id === level.world);

// ------------------------------------------------------------------ small helpers
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}
function buzz(pattern) {
  if (save.settings.buzz && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) { /* not allowed here */ }
  }
}
function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== 'scr-' + id;
  screen = id;
  $('hud').hidden = id !== 'race';
  if (id !== 'race') input.enabled = false;
  if (id === 'title') titleLoop.start();
  else titleLoop.stop();
  const first = document.querySelector(`#scr-${id} h2, #scr-${id} h1`);
  if (first) {
    first.setAttribute('tabindex', '-1');
    first.focus({ preventScroll: true });
  }
}
function fitCanvas(cv, cssSize) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cssSize || cv.clientWidth || 80;
  cv.width = cv.height = Math.round(w * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.translate(cv.width / 2, cv.height / 2);
  return { ctx, r: cv.width / 2 };
}
function drawFace(cv, look, collar, cssSize, t = 0) {
  const { ctx, r } = fitCanvas(cv, cssSize);
  ctx.translate(0, -r * 0.08);
  A.drawDogFace(ctx, look, r * 0.74, { collar, t });
}
function segSet(buttons, value, attr) {
  for (const b of buttons) b.setAttribute('aria-checked', String((attr ? b.getAttribute(attr) : b.dataset.v) === String(value)));
}

// ------------------------------------------------------------------ title animation
const titleLoop = {
  id: 0, t: 0,
  start() {
    if (this.id) return;
    let prev = performance.now();
    const step = (now) => {
      this.t += Math.min(0.05, (now - prev) / 1000);
      prev = now;
      this.draw();
      this.id = requestAnimationFrame(step);
    };
    this.id = requestAnimationFrame(step);
  },
  stop() {
    cancelAnimationFrame(this.id);
    this.id = 0;
  },
  draw() {
    const cv = $('title-cv');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = this.t;
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 137 + t * (8 + i * 3)) % (w + 160)) - 80, y = h * (0.04 + i * 0.045);
      for (const [ox, oy, rx, ry] of [[0, 0, 44, 15], [26, -9, 26, 15], [-22, -6, 22, 12]]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, rx, ry, 0, 0, 7);
        ctx.fill();
      }
    }
    // a road across the grass
    const ry = h * 0.33;
    const k = Math.min(1.5, w / 290);
    ctx.fillStyle = '#727987';
    ctx.fillRect(0, ry - 46 * k, w, 92 * k);
    ctx.fillStyle = '#f4ecc9';
    for (let x = -((t * 220) % 70); x < w; x += 70) ctx.fillRect(x, ry - 3, 36, 6);
    // the chase, running left to right
    const lead = w * 0.86 + Math.sin(t * 1.3) * 10;
    const put = (x, y, fn) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2);
      ctx.scale(k, k);
      fn();
      ctx.restore();
    };
    put(lead, ry - 6 + Math.sin(t * 9) * 3, () => A.drawCatTop(ctx, { state: 'run', run: t * 22, t }));
    const pack = ['zazu', 'pitbull', 'corgi', 'husky'];
    pack.forEach((id, i) => {
      const x = lead - (86 + i * 52) * k + Math.sin(t * 2 + i * 1.7) * 10;
      const y = ry + [-14, 16, -22, 22][i] * k + Math.sin(t * 3 + i) * 4;
      put(x, y, () => A.drawDogTop(ctx, dogDefs[id].look, { size: dogDefs[id].size * 0.95, run: t * 20 + i, speed: 1, collar: slotColors[i], t, tongue: true }));
    });
  }
};

// ------------------------------------------------------------------ dog picker
let pickId = null;
function buildDogs() {
  const grid = $('dog-grid');
  grid.textContent = '';
  for (const d of dogList) {
    const b = document.createElement('button');
    b.className = 'dog';
    b.setAttribute('role', 'radio');
    b.dataset.id = d.id;
    const cv = document.createElement('canvas');
    const name = document.createElement('span');
    name.textContent = d.name;
    const lv = document.createElement('span');
    lv.className = 'lv';
    b.append(cv, name, lv);
    b.addEventListener('click', () => {
      sound.unlock();
      sound.play('click');
      selectDog(d.id);
    });
    grid.append(b);
  }
}
function refreshDogs() {
  for (const b of $('dog-grid').children) {
    const d = dogDefs[b.dataset.id];
    drawFace(b.querySelector('canvas'), d.look, slotColors[0], 76);
    b.querySelector('.lv').textContent = 'Lv ' + dogLevel(d.id);
    b.setAttribute('aria-checked', String(d.id === pickId));
    b.setAttribute('aria-label', `${d.name}, level ${dogLevel(d.id)}`);
  }
}
function selectDog(id) {
  pickId = id;
  refreshDogs();
  const d = dogDefs[id], card = $('dog-card');
  const lvl = dogLevel(id), love = dogSave(id).love;
  const a = loveForLevel(lvl, rules), b = loveForLevel(lvl + 1, rules);
  const max = lvl >= rules.love.maxLevel;
  card.textContent = '';
  const head = document.createElement('div');
  head.className = 'dog-head';
  const cv = document.createElement('canvas');
  const txt = document.createElement('div');
  txt.innerHTML = `<h3></h3><p class="fine"></p>`;
  txt.querySelector('h3').textContent = d.name;
  txt.querySelector('p').textContent = d.tagline;
  head.append(cv, txt);
  const stats = document.createElement('div');
  stats.className = 'stats';
  for (const [label, key] of [['Speed', 'speed'], ['Swim', 'swim'], ['Chomp', 'chomp'], ['Heart', 'heart']]) {
    const l = document.createElement('span');
    l.textContent = label;
    const pips = document.createElement('div');
    pips.className = 'pips';
    pips.setAttribute('role', 'img');
    pips.setAttribute('aria-label', `${d.bars[key]} out of 5`);
    for (let i = 1; i <= 5; i++) {
      const p = document.createElement('i');
      if (i <= d.bars[key]) p.className = 'on';
      pips.append(p);
    }
    stats.append(l, pips);
  }
  const perk = document.createElement('p');
  perk.className = 'perk';
  perk.innerHTML = '<b></b> <span></span>';
  perk.querySelector('b').textContent = d.perk.name + ':';
  perk.querySelector('span').textContent = d.perk.text;
  const rank = document.createElement('p');
  rank.className = 'fine';
  rank.textContent = `Level ${lvl} ${rankTitle(lvl, rules)}` + (max ? ' (top level)' : `, ${fmt(b - love)} Love to level ${lvl + 1}`);
  const meter = document.createElement('div');
  meter.className = 'meter';
  const fill = document.createElement('i');
  fill.style.width = (max ? 100 : Math.round(((love - a) / (b - a)) * 100)) + '%';
  meter.append(fill);
  card.append(head, stats, perk, meter, rank);
  drawFace(cv, d.look, slotColors[0], 96);
  $('btn-dog-go').textContent = lobbyPick ? `Race as ${d.name}` : `Run with ${d.name}`;
}
function openDogs(forLobby) {
  lobbyPick = !!forLobby;
  show('dogs');
  selectDog(save.dog || 'zazu');
}

// ------------------------------------------------------------------ level list
function buildLevels() {
  const list = $('level-list');
  list.textContent = '';
  let nextId = 1;
  for (const l of levelData.levels) if (unlocked(l.id)) nextId = l.id;
  for (const w of levelData.worlds) {
    const sec = document.createElement('section');
    sec.className = 'world';
    const h = document.createElement('h3');
    h.textContent = w.name;
    const p = document.createElement('p');
    p.className = 'fine';
    p.textContent = w.story;
    const grid = document.createElement('div');
    grid.className = 'levels';
    for (const l of levelData.levels.filter((x) => x.world === w.id)) {
      const b = document.createElement('button');
      const open = unlocked(l.id);
      const st = (save.levels[l.id] || {}).stars || 0;
      b.className = 'lvl' + (l.boss ? ' boss' : '') + (open ? '' : ' locked') + (l.id === nextId && !st ? ' next' : '');
      b.disabled = !open;
      const n = document.createElement('span');
      n.textContent = l.id;
      const s = document.createElement('small');
      s.textContent = open ? (l.boss && !st ? 'BOSS' : '★'.repeat(st) + '☆'.repeat(3 - st)) : 'LOCKED';
      b.append(n, s);
      b.setAttribute('aria-label', `Level ${l.id}, ${l.name}${l.boss ? ', boss' : ''}, ${open ? st + ' of 3 stars' : 'locked'}`);
      b.addEventListener('click', () => {
        sound.unlock();
        sound.play('click');
        openBrief(l);
      });
      grid.append(b);
    }
    sec.append(h, p, grid);
    list.append(sec);
  }
  const d = dogDefs[save.dog || 'zazu'];
  drawFace($('chip-cv'), d.look, slotColors[0], 40);
  $('chip-text').textContent = `${d.name} Lv ${dogLevel(d.id)}`;
}

// ------------------------------------------------------------------ before the race
function setControl(mode) {
  save.settings.control = mode;
  persist();
  for (const [t, p] of [['ctl-tilt', 'ctl-pad'], ['p-tilt', 'p-pad'], ['s-tilt', 's-pad']]) {
    $(t).setAttribute('aria-checked', String(mode === 'tilt'));
    $(p).setAttribute('aria-checked', String(mode === 'pad'));
  }
  $('ctl-help').textContent = mode === 'tilt'
    ? (framed ? 'Tilt steering needs the game opened at its own web address, not inside a preview. ' : '') +
      'Hold the phone however is comfy when the countdown starts. That is your stay spot. Tip it forward to run, lean to steer, tip it back to back up. Tap the screen for Zoomies.'
    : 'Drag your thumb anywhere to steer and hit ZOOM for Zoomies. On a keyboard, use the arrow keys and the space bar.';
  if (input) input.mode = mode;
  $('tiltdot').hidden = mode !== 'tilt';
}
function drawMeet(def, boss) {
  const { ctx, r } = fitCanvas($('meet-cv'), 80);
  ctx.scale(r / 30, r / 30);
  ctx.translate(0, 2);
  A.drawVillain(ctx, def.look, { t: 0, boss: false, state: boss ? 'windup' : '' });
}
function openBrief(level) {
  current = { level, localSlot: 0, friends: false };
  const w = worldOf(level);
  $('brief-world').textContent = w.name;
  $('brief-num').textContent = `Level ${level.id} of ${levelData.levels.length}` + (level.boss ? ' • Boss' : '');
  $('brief-name').textContent = level.name;
  $('brief-story').textContent = level.id % 5 === 1 ? w.story : '';
  $('brief-story').hidden = level.id % 5 !== 1;
  const def = level.boss ? villains.bosses[level.boss] : level.meet ? villains.types[level.meet] : null;
  $('brief-meet').hidden = !def;
  if (def) {
    $('meet-name').textContent = (level.boss ? 'Boss: ' : 'New Bad Owner: ') + def.name;
    $('meet-crime').textContent = level.boss ? def.title + '.' : def.crime;
    $('meet-tip').textContent = def.tip;
    drawMeet(def, !!level.boss);
  }
  const goals = $('brief-stars');
  goals.textContent = '';
  rules.stars.forEach((txt, i) => {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = '★'.repeat(i + 1);
    li.append(b, document.createTextNode(i === 2 ? `${txt} (${level.par} seconds)` : txt));
    goals.append(li);
  });
  setControl(save.settings.control);
  show('brief');
}

async function readyControls() {
  sound.unlock();
  if (save.settings.control !== 'tilt') return;
  const res = await input.enableTilt();
  if (res === 'ok') return;
  setControl('pad');
  toast(res === 'denied'
    ? 'Motion access was turned off, so you are on thumb steering. You can switch back in Settings.'
    : 'No tilt sensor here, so you are on thumb steering.', 3600);
}

function pickRivals(level, mine) {
  const pool = dogList.filter((d) => d.npc && d.id !== mine).map((d) => d.id);
  let s = level.seed + save.attempts * 7919;
  const out = [];
  while (out.length < 3 && pool.length) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(pool.splice(s % pool.length, 1)[0]);
  }
  return out;
}

function startSolo(level) {
  const mine = save.dog || 'zazu';
  save.attempts++;
  persist();
  const rivals = pickRivals(level, mine);
  const racers = [{ slot: 0, dogId: mine, control: qs.has('bot') ? 'ai' : 'local', dogLevel: dogLevel(mine) }];
  rivals.forEach((id, i) => racers.push({ slot: i + 1, dogId: id, control: 'ai', dogLevel: Math.max(1, Math.round(level.id / 3)) }));
  current = { level, localSlot: 0, friends: false };
  beginRace(racers, level.seed + save.attempts);
}

function beginRace(racers, seed) {
  const level = current.level;
  const world = worldOf(level);
  const track = buildTrack(level, world, rules, villains, levelData.levels.length);
  const npc = { skill: blend(levelData.npc.skill, track.diff), aggression: blend(levelData.npc.aggression, track.diff) };
  race = new Race({ track, rules, dogDefs, racers, seed, npc });
  renderer.resize();
  renderer.setRace(race, { localSlot: current.localSlot, slotColors });
  buildHud();
  show('race');
  input.mode = save.settings.control;
  input.sens = save.settings.sens;
  input.enabled = true;
  input.endPad();
  running = true;
  paused = false;
  waiting = false;
  acc = 0;
  endTimer = -1;
  $('banner').hidden = true;
  $('tiltdot').hidden = save.settings.control !== 'tilt';
  if (document.activeElement) document.activeElement.blur();
  sound.music = save.settings.music;
  sound.sfx = save.settings.sfx;
  sound.startMusic(126 + world.id * 6);
  keepAwake(true);
  try {
    // Only some browsers allow this, and only full screen. It stops a hard lean from flipping the page.
    const lock = window.screen.orientation && window.screen.orientation.lock && window.screen.orientation.lock('portrait');
    if (lock && lock.catch) lock.catch(() => {});
  } catch (e) { /* not supported here */ }
}

// ------------------------------------------------------------------ HUD
const hud = { marks: [], cat: null, place: '', score: -1, time: '', e: -1 };
function buildHud() {
  const lane = $('lane');
  for (const el of lane.querySelectorAll('b')) el.remove();
  hud.marks = race.dogs.map((d) => {
    const b = document.createElement('b');
    b.style.background = slotColors[d.slot];
    if (d.slot === current.localSlot) b.style.zIndex = 2;
    lane.append(b);
    return b;
  });
  hud.cat = document.createElement('b');
  hud.cat.className = 'cat';
  lane.append(hud.cat);
  hud.place = '';
  hud.score = -1;
  hud.time = '';
  hud.e = -1;
}
function updateHud() {
  const me = race.dogs[current.localSlot], T = race.track;
  let ahead = 0;
  for (const d of race.dogs) {
    if (d === me || d.left) continue;
    if (me.finished ? d.finished && d.place < me.place : d.finished || d.y > me.y) ahead++;
  }
  const place = ORD[ahead];
  if (place !== hud.place) $('place').textContent = hud.place = place;
  if (me.score !== hud.score) $('score').textContent = fmt(hud.score = me.score);
  const tm = (me.finished ? me.time : race.t).toFixed(1);
  if (tm !== hud.time) $('timer').textContent = (hud.time = tm) + 's';
  race.dogs.forEach((d, i) => {
    hud.marks[i].style.left = Math.max(0, Math.min(100, (d.y / T.finishY) * 100)) + '%';
    hud.marks[i].hidden = !!d.left;
  });
  hud.cat.style.left = Math.max(0, Math.min(100, (race.cat.y / T.finishY) * 100)) + '%';
  const e = Math.round(me.energy * 20);
  if (e !== hud.e) {
    hud.e = e;
    const pips = $('energy').children;
    for (let i = 0; i < pips.length; i++) {
      const f = Math.max(0, Math.min(1, me.energy - i));
      pips[i].style.setProperty('--fill', Math.round(f * 100) + '%');
      pips[i].classList.toggle('full', f >= 1);
    }
    $('btn-zoom').disabled = me.energy < 1;
  }
  if (save.settings.control === 'tilt') {
    const r = input.tiltRaw();
    $('tiltdot').firstElementChild.style.transform = `translate(${r.x * 20}px, ${-r.y * 20}px)`;
  }
  const left = race.secondsLeft();
  const banner = $('banner');
  let msg = '';
  if (waiting) msg = 'Waiting for the rest of the pack...';
  else if (left != null && !me.finished) msg = `Hurry! The cat is getting bored: ${Math.ceil(left)}`;
  else if (input.tiltStale() && race.phase === 'run' && race.t > 2) msg = 'No tilt signal. Pause to switch to thumb steering.';
  else if (race.phase === 'run' && race.t > 2.5 && me.y < 150 && me.control === 'local') {
    msg = save.settings.control === 'tilt' ? 'Tip your phone forward to run!' : 'Drag your thumb up to run!';
  }
  if (msg !== banner.textContent) banner.textContent = msg;
  banner.hidden = !msg;
}

// ------------------------------------------------------------------ race loop
const SFX = {
  count: 'count', go: 'go', splash: 'splash', hugstart: 'hugstart', hug: 'hug', chomp: 'chomp', bosshit: 'bosshit',
  bossdown: 'bossdown', hit: 'hit', free: 'free', bonk: 'bonk', knock: 'knock', zoom: 'zoom', yell: 'yell',
  windup: 'windup', swing: 'swing', throw: 'throw', pop: 'pop', tag: 'tag', bone: 'bone'
};
function onRaceEvent(ev) {
  renderer.onEvent(ev);
  const me = race.dogs[current.localSlot];
  const mine = ev.slot === current.localSlot;
  const near = ev.y == null || Math.abs(ev.y - me.y) < 900;
  if (SFX[ev.type] && near && (mine || ev.type !== 'bone')) sound.play(SFX[ev.type], mine || ev.slot == null);
  if (ev.type === 'cat' && near) sound.play('meow', false);
  if (ev.type === 'count' && ev.n === 3) input.calibrate();
  if (mine) {
    if (ev.type === 'hit') buzz(80);
    else if (ev.type === 'chomp' || ev.type === 'bosshit') buzz([30, 40, 70]);
    else if (ev.type === 'hug') buzz(25);
    else if (ev.type === 'finish') {
      sound.play(ev.place === 1 ? 'win' : 'star');
      if (net) {
        net.sendFinish(race, current.localSlot);
        waiting = true;
      } else endTimer = 2.4;
    }
  }
  if (ev.type === 'timeup' || ev.type === 'end') {
    if (net) {
      if (!me.reported) net.sendFinish(race, current.localSlot);
      waiting = true;
    } else if (endTimer < 0) endTimer = 0.6;
  }
  if (net && ev.net) {
    const d = race.dogs[ev.slot];
    if (mine || (net.isHost && d && d.control === 'ai')) net.sendEvent(ev);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (!running || !race) return;
  if (!paused) {
    acc += dt;
    let guard = 0;
    while (acc >= DT && guard++ < 5) {
      const inp = input.read();
      if (race.dogs[current.localSlot].control === 'local') race.setInput(current.localSlot, inp.x, inp.y, inp.zoom);
      race.step(DT);
      acc -= DT;
      if (race.events.length) {
        const evs = race.events.splice(0);
        for (const ev of evs) onRaceEvent(ev);
      }
    }
    if (net) net.tick(race, current.localSlot, dt);
    if (endTimer >= 0) {
      endTimer -= dt;
      if (endTimer < 0) {
        finishSolo();
        return;
      }
    }
    updateHud();
  }
  renderer.frame(paused ? 0 : dt);
}

// Tilt play has no touches, so ask the phone not to dim or lock the screen mid-race.
let wake = null;
async function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => {
        wake = null;
      });
    } else if (!on && wake) {
      const w = wake;
      wake = null;
      await w.release();
    }
  } catch (e) {
    wake = null;
  }
}

function stopRace() {
  running = false;
  keepAwake(false);
  input.enabled = false;
  input.endPad();
  sound.stopMusic();
}

// ------------------------------------------------------------------ results
function finishSolo() {
  if (race.phase !== 'over') race.forceEnd('end');
  race.events.length = 0;
  stopRace();
  showResults(race.summary(current.localSlot), null);
}

function showResults(sum, pack) {
  const level = current.level, mine = race.dogs[current.localSlot];
  const id = mine.id, def = dogDefs[id];
  // save progress
  const before = dogLevel(id);
  dogSave(id).love += sum.love;
  const after = dogLevel(id);
  let newBest = false;
  if (!current.friends) {
    const rec = save.levels[level.id] || (save.levels[level.id] = { stars: 0, best: 0 });
    if (sum.total > rec.best) {
      rec.best = sum.total;
      newBest = true;
    }
    rec.stars = Math.max(rec.stars, sum.stars);
  }
  persist();

  const won = sum.place === 1 && !sum.dnf;
  $('res-title').textContent = sum.dnf ? 'The cat got away!' : won ? '1st place! Cat treed!' : `${ORD[sum.place - 1]} place`;
  const stars = $('res-stars');
  stars.textContent = '';
  stars.hidden = current.friends;
  stars.setAttribute('aria-label', `${sum.stars} of 3 stars`);
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.textContent = '★';
    if (i < sum.stars) s.className = 'on';
    stars.append(s);
  }
  const body = $('res-table').tBodies[0];
  body.textContent = '';
  for (const [label, count, pts] of sum.lines) {
    if (!pts && !count) continue;
    const tr = body.insertRow();
    tr.insertCell().textContent = label;
    tr.insertCell().textContent = count == null ? '' : label === 'Finish place' ? ORD[count - 1] : '×' + count;
    tr.insertCell().textContent = fmt(pts);
  }
  $('res-total').textContent = fmt(sum.total);
  const timeTxt = sum.dnf ? 'Did not finish' : `Time ${sum.time.toFixed(1)}s (par ${sum.par}s)`;
  $('res-best').textContent = timeTxt + (newBest && !current.friends ? '. New best score!' : '');

  drawFace($('res-cv'), def.look, slotColors[current.localSlot], 72);
  $('res-rank').textContent = `${def.name}: Level ${after} ${rankTitle(after, rules)}`;
  const love = dogSave(id).love;
  const a = loveForLevel(after, rules), b = loveForLevel(after + 1, rules);
  const max = after >= rules.love.maxLevel;
  $('res-love').style.width = '0%';
  requestAnimationFrame(() => {
    $('res-love').style.width = (max ? 100 : Math.round(((love - a) / (b - a)) * 100)) + '%';
  });
  $('res-lovetext').textContent = `+${sum.love} Love` + (after > before ? `. LEVEL UP! A little faster, and scores count for more.` : max ? '' : `. ${fmt(b - love)} to level ${after + 1}.`);

  const packEl = $('res-pack');
  packEl.hidden = !pack;
  if (pack) {
    packEl.textContent = '';
    for (const r of pack) {
      const row = document.createElement('div');
      if (r.slot === current.localSlot) row.className = 'me';
      const who = r.slot === current.localSlot ? 'You' : r.bot ? dogDefs[r.dogId].name + ' (computer)' : 'Player ' + (r.slot + 1);
      for (const txt of [ORD[r.place - 1], who, r.dnf ? 'DNF' : r.time.toFixed(1) + 's', fmt(r.total)]) {
        const s = document.createElement('span');
        s.textContent = txt;
        row.append(s);
      }
      packEl.append(row);
    }
  }
  const last = level.id === levelData.levels.length;
  const st = $('res-story');
  st.hidden = !(last && sum.stars >= 1 && !current.friends);
  st.textContent = story.ending;
  $('btn-next').hidden = current.friends || last;
  $('btn-next').disabled = !unlocked(level.id + 1);
  $('btn-retry').textContent = current.friends ? 'Back to the pack' : 'Again';
  $('btn-res-menu').textContent = current.friends ? 'Leave pack' : 'Levels';
  show('results');
  sound.unlock();
  if (after > before) sound.play('levelup');
  else sound.play(sum.stars > 0 ? 'win' : 'lose');
}

// ------------------------------------------------------------------ friend races
async function getNet() {
  if (net) return net;
  const mod = await import('./net.js');
  net = new mod.Net({ server: qs.get('peer') });
  net.onLobby = renderLobby;
  net.onStart = (cfg) => {
    const level = levelData.levels.find((l) => l.id === cfg.levelId);
    current = { level, localSlot: net.slot, friends: true };
    const racers = cfg.racers.map((r) => ({
      slot: r.slot, dogId: r.dogId, dogLevel: r.dogLevel,
      control: r.slot === net.slot ? 'local' : r.bot && net.isHost ? 'ai' : 'remote'
    }));
    beginRace(racers, cfg.seed);
  };
  net.onStates = (list) => {
    if (race && running) for (const s of list) race.setRemote(s);
  };
  net.onEvent = (ev) => {
    if (race && running) race.applyRemote(ev);
  };
  net.onResults = (res) => {
    if (!race) return;
    race.events.length = 0;
    const mine = res.find((r) => r.slot === current.localSlot);
    const d = race.dogs[current.localSlot];
    if (mine) {
      d.place = mine.place;
      d.dnf = mine.dnf;
    }
    stopRace();
    showResults(race.summary(current.localSlot), res);
  };
  net.onLeft = (slot) => {
    if (race && race.dogs[slot]) {
      race.dogs[slot].left = true;
      race.dogs[slot].finished = true;
      race.dogs[slot].dnf = true;
    }
  };
  net.onClosed = (why) => {
    const wasRacing = running;
    stopRace();
    net = null;
    toast(why || 'The pack broke up.', 3200);
    if (wasRacing || screen === 'friends' || screen === 'results') openFriends();
  };
  return net;
}
function openFriends(code) {
  show('friends');
  if (framed) {
    $('btn-host').disabled = true;
    $('join-form').hidden = true;
    $('fr-start').querySelector('p').textContent = 'Friend races link phones directly, which only works with the game opened at its own web address, not inside a preview.';
  }
  $('fr-start').hidden = !!(net && net.code);
  $('fr-lobby').hidden = !(net && net.code);
  $('join-msg').textContent = '';
  if (code) $('join-code').value = code;
  if (net && net.code) renderLobby(net.lobby);
}
function renderLobby(lobby) {
  if (!lobby || screen === 'race') return;
  $('fr-start').hidden = true;
  $('fr-lobby').hidden = false;
  $('lobby-code').textContent = lobby.code;
  const list = $('lobby-list');
  list.textContent = '';
  for (let s = 0; s < 4; s++) {
    const p = lobby.players.find((x) => x.slot === s);
    const li = document.createElement('li');
    li.style.borderColor = slotColors[s];
    const cv = document.createElement('canvas');
    const txt = document.createElement('div');
    if (p) {
      const d = dogDefs[p.dogId];
      txt.innerHTML = '<span></span><small></small>';
      txt.querySelector('span').textContent = s === net.slot ? 'You' : 'Player ' + (s + 1);
      txt.querySelector('small').textContent = `${d.name} Lv ${p.dogLevel}` + (s === 0 ? ' • host' : '');
      li.append(cv, txt);
      list.append(li);
      drawFace(cv, d.look, slotColors[s], 48);
    } else {
      txt.innerHTML = '<span>Open spot</span><small>A computer dog fills in</small>';
      li.append(txt);
      list.append(li);
    }
  }
  const level = levelData.levels.find((l) => l.id === lobby.levelId) || levelData.levels[0];
  $('lobby-lvl-num').textContent = `Level ${level.id} • ${worldOf(level).name}`;
  $('lobby-lvl-name').textContent = level.name;
  $('lvl-prev').hidden = $('lvl-next').hidden = !net.isHost;
  $('btn-lobby-go').hidden = !net.isHost;
  $('lobby-msg').textContent = net.isHost ? 'Share the code, then start when everyone is in.' : 'Waiting for the host to start the race.';
}
function myDogForNet() {
  const id = save.dog || 'zazu';
  return { dogId: id, dogLevel: dogLevel(id) };
}
async function hostPack() {
  await readyControls();
  $('join-msg').textContent = 'Starting a pack...';
  try {
    const n = await getNet();
    await n.host(myDogForNet(), 1);
    openFriends();
  } catch (e) {
    net = null;
    $('join-msg').textContent = e.message || 'Could not start a pack. Check your connection and try again.';
  }
}
async function joinPack(code) {
  await readyControls();
  code = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) {
    $('join-msg').textContent = 'Pack codes are four letters.';
    return;
  }
  $('join-msg').textContent = 'Looking for that pack...';
  try {
    const n = await getNet();
    await n.join(code, myDogForNet());
    openFriends();
  } catch (e) {
    net = null;
    $('join-msg').textContent = e.message || 'Could not join. Check the code and try again.';
  }
}
function leavePack() {
  if (net) {
    net.onClosed = null;
    net.leave();
    net = null;
  }
}

// ------------------------------------------------------------------ wiring
function wire() {
  const click = (id, fn) => $(id).addEventListener('click', (e) => {
    sound.unlock();
    sound.play('click');
    fn(e);
  });
  click('btn-play', () => {
    if (!save.seenIntro) return playIntro(() => openDogs(false));
    if (!save.dog) return openDogs(false);
    buildLevels();
    show('levels');
  });
  click('btn-how', () => playIntro(() => show('title')));
  click('btn-settings', () => {
    refreshSettings();
    show('settings');
  });
  click('btn-friends', () => {
    if (!save.dog) {
      save.dog = 'zazu';
      persist();
    }
    openFriends();
  });
  click('btn-dog-go', () => {
    save.dog = pickId;
    persist();
    if (lobbyPick) {
      if (net) net.setDog(myDogForNet());
      openFriends();
    } else {
      buildLevels();
      show('levels');
    }
  });
  click('btn-change-dog', () => openDogs(false));
  click('btn-start', async () => {
    await readyControls();
    startSolo(current.level);
  });
  for (const b of document.querySelectorAll('[data-back]')) {
    b.addEventListener('click', () => {
      sound.play('click');
      if (screen === 'brief') {
        buildLevels();
        show('levels');
      } else if (screen === 'dogs' && lobbyPick) openFriends();
      else if (screen === 'friends') {
        leavePack();
        show('title');
      } else show('title');
    });
  }
  click('ctl-tilt', () => setControl('tilt'));
  click('ctl-pad', () => setControl('pad'));
  click('s-tilt', () => setControl('tilt'));
  click('s-pad', () => setControl('pad'));
  click('p-pad', () => setControl('pad'));
  click('p-tilt', async () => {
    setControl('tilt');
    await readyControls();
    input.calibrate();
  });

  // race buttons
  $('btn-zoom').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.zoomQueued = true;
  });
  click('btn-pause', () => pause(true));
  click('btn-resume', () => pause(false));
  click('btn-recenter', () => {
    input.calibrate();
    toast('Got it. That is your new stay position.');
    pause(false);
  });
  click('btn-restart', () => {
    $('scr-pause').hidden = true;
    stopRace();
    if (current.friends) return;
    startSolo(current.level);
  });
  click('btn-quit', () => {
    $('scr-pause').hidden = true;
    stopRace();
    if (current.friends) {
      leavePack();
      show('title');
    } else {
      buildLevels();
      show('levels');
    }
  });

  // results
  click('btn-retry', async () => {
    if (current.friends) return openFriends();
    await readyControls();
    startSolo(current.level);
  });
  click('btn-next', () => {
    const next = levelData.levels.find((l) => l.id === current.level.id + 1);
    if (next) openBrief(next);
  });
  click('btn-res-menu', () => {
    if (current.friends) {
      leavePack();
      show('title');
    } else {
      buildLevels();
      show('levels');
    }
  });

  // friends
  click('btn-host', hostPack);
  $('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sound.unlock();
    joinPack($('join-code').value);
  });
  click('btn-share', async () => {
    const url = `${location.origin}${location.pathname}?pack=${net.code}`;
    const text = `Race me in Chase the Cat! Pack code ${net.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Chase the Cat', text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Invite copied. Paste it to your friends.');
      }
    } catch (e) {
      toast(`Tell your friends the code: ${net.code}`);
    }
  });
  click('btn-lobby-dog', () => openDogs(true));
  const stepLevel = (dir) => {
    const open = levelData.levels.filter((l) => unlocked(l.id)).map((l) => l.id);
    const i = open.indexOf(net.lobby.levelId);
    net.setLevel(open[(i + dir + open.length) % open.length]);
  };
  click('lvl-prev', () => stepLevel(-1));
  click('lvl-next', () => stepLevel(1));
  click('btn-lobby-go', async () => {
    await readyControls();
    const used = new Set(net.lobby.players.map((p) => p.dogId));
    const pool = dogList.filter((d) => d.npc && !used.has(d.id)).map((d) => d.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    net.start(Math.floor(Math.random() * 1e6), pool);
  });

  // settings
  for (const b of document.querySelectorAll('[data-sens]')) {
    b.addEventListener('click', () => {
      save.settings.sens = Number(b.dataset.sens);
      persist();
      refreshSettings();
    });
  }
  for (const [id, key] of [['s-sfx', 'sfx'], ['s-music', 'music'], ['s-buzz', 'buzz']]) {
    click(id, () => {
      save.settings[key] = !save.settings[key];
      persist();
      refreshSettings();
      if (key === 'buzz' && save.settings.buzz) buzz(40);
    });
  }
  click('btn-replay-intro', () => playIntro(() => show('settings')));
  let armed = false;
  click('btn-reset', () => {
    const b = $('btn-reset');
    if (!armed) {
      armed = true;
      b.textContent = 'Tap again to erase everything';
      setTimeout(() => {
        armed = false;
        b.textContent = 'Erase my progress';
      }, 4000);
      return;
    }
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* nothing saved */ }
    location.reload();
  });

  window.addEventListener('resize', () => {
    renderer.resize();
    checkRotate();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !current.friends) pause(true);
    if (document.hidden) sound.stopMusic();
    else if (running) keepAwake(true);
  });
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && running) pause($('scr-pause').hidden);
  });
}

function pause(on) {
  if (!running) return;
  if (current.friends) {
    // A friend race keeps going for everyone else, so this is only a menu.
    $('scr-pause').hidden = !on;
    $('btn-restart').hidden = true;
    return;
  }
  paused = on;
  $('scr-pause').hidden = !on;
  $('btn-restart').hidden = false;
  input.enabled = !on;
  if (on) {
    input.endPad();
    sound.stopMusic();
    $('btn-resume').focus();
  } else {
    sound.startMusic(126 + worldOf(current.level).id * 6);
  }
}

function refreshSettings() {
  setControl(save.settings.control);
  segSet(document.querySelectorAll('[data-sens]'), save.settings.sens, 'data-sens');
  $('s-sfx').setAttribute('aria-checked', String(save.settings.sfx));
  $('s-music').setAttribute('aria-checked', String(save.settings.music));
  $('s-buzz').setAttribute('aria-checked', String(save.settings.buzz));
  $('s-sfx').setAttribute('aria-label', 'Sound effects');
  $('s-music').setAttribute('aria-label', 'Music');
  $('s-buzz').setAttribute('aria-label', 'Vibration');
  sound.sfx = save.settings.sfx;
  sound.music = save.settings.music;
  if (input) input.sens = save.settings.sens;
}

function playIntro(done) {
  show('intro');
  intro.play(() => {
    save.seenIntro = true;
    persist();
    done();
  });
}

function checkRotate() {
  const land = window.innerWidth > window.innerHeight && window.innerHeight < 520 && coarse;
  $('rotate').hidden = !land;
  if (land && running && !paused && current && !current.friends) pause(true);
}

// ------------------------------------------------------------------ boot
async function boot() {
  loadSave();
  const names = ['rules', 'dogs', 'villains', 'levels', 'story'];
  let data;
  try {
    data = await Promise.all(names.map((n) => fetch(`data/${n}.json`).then((r) => {
      if (!r.ok) throw new Error(n);
      return r.json();
    })));
  } catch (e) {
    $('fineprint').textContent = 'Could not load the game files. Check your connection and reload.';
    return;
  }
  [rules, , villains, levelData, story] = data;
  dogList = data[1].dogs;
  slotColors = data[1].slotColors;
  dogDefs = Object.fromEntries(dogList.map((d) => [d.id, d]));
  if (save.dog && !dogDefs[save.dog]) save.dog = null;

  renderer = new Renderer($('game'));
  input = new Input($('touch'), $('stick'), $('nub'));
  intro = new Intro({
    canvas: $('intro-cv'), face: $('sven-cv'), text: $('intro-text'), dots: $('intro-dots'),
    next: $('btn-intro-next'), skip: $('btn-intro-skip'), story, dogDefs, slotColors, villains, sound
  });
  buildDogs();
  wire();
  refreshSettings();
  checkRotate();
  show('title');
  requestAnimationFrame(frame);

  // test and demo hooks: ?level=7 jumps straight into a level, &bot lets the computer run your dog
  window.__ctc = { get race() { return race; }, save, get net() { return net; }, get screen() { return screen; }, input, renderer };
  if (qs.has('level')) {
    const l = levelData.levels.find((x) => x.id === Number(qs.get('level')));
    if (l) {
      if (qs.get('dog') && dogDefs[qs.get('dog')]) save.dog = qs.get('dog');
      if (qs.get('control')) save.settings.control = qs.get('control');
      current = { level: l, localSlot: 0, friends: false };
      startSolo(l);
    }
  } else if (qs.get('pack')) {
    if (!save.dog) save.dog = 'zazu';
    openFriends(qs.get('pack').toUpperCase().slice(0, 4));
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
