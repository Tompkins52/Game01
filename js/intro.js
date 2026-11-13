// Sven's animated how-to-play. Each line of data/story.json "intro" names a scene drawn here.

import * as A from './art.js';
import { FONT } from './render.js';

const TAU = Math.PI * 2;
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t, a, b) => c01((t - a) / (b - a));
const ease = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;

function put(ctx, x, y, rot, sc, fn) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(sc, sc);
  fn();
  ctx.restore();
}
function label(ctx, x, y, str, color, size, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.22;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,12,30,0.9)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}
// Grass with a road up the middle, like a level. Returns the road's left edge and width.
function field(ctx, w, h, scroll = 0) {
  ctx.fillStyle = '#7cc36a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#6ab35a';
  for (let y = -160 + (scroll % 160); y < h; y += 160) ctx.fillRect(0, y, w, 80);
  const rw = Math.min(w * 0.72, 330), rx = (w - rw) / 2;
  ctx.fillStyle = '#727987';
  ctx.fillRect(rx, 0, rw, h);
  ctx.fillStyle = '#cfd3da';
  ctx.fillRect(rx - 8, 0, 8, h);
  ctx.fillRect(rx + rw, 0, 8, h);
  ctx.fillStyle = '#f4ecc9';
  for (let y = -90 + (scroll % 90); y < h; y += 90) {
    ctx.fillRect(rx + rw / 3 - 3, y, 6, 40);
    ctx.fillRect(rx + (2 * rw) / 3 - 3, y, 6, 40);
  }
  return { rx, rw };
}
function puddle(ctx, x, y, rx, ry, t) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 5, ry + 5, 0, 0, TAU);
  ctx.fillStyle = '#2f86c0';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = '#4aa8e0';
  ctx.fill();
  ctx.strokeStyle = '#8fd0f5';
  ctx.lineWidth = 2.5;
  const k = (t * 0.4) % 1;
  ctx.globalAlpha = 1 - k;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * (0.3 + k * 0.6), ry * (0.3 + k * 0.6), 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function hearts(ctx, x, y, t, n, spread) {
  for (let i = 0; i < n; i++) {
    const k = (t * 0.9 + i / n) % 1;
    const a = i * 2.4;
    ctx.globalAlpha = 1 - k;
    A.heart(ctx, x + Math.cos(a) * spread * k, y - k * spread * 1.4 + Math.sin(a) * 8, 7 + k * 5);
    ctx.fillStyle = '#ff6b8b';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function phone(ctx, x, y, pose, k, sc) {
  // pose: forward, left, stay, back. k (0..1) is how far into the pose we are.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  let top = 62, bot = 62, hgt = 124, rot = 0;
  if (pose === 'forward') {
    top = lerp(62, 44, k);
    hgt = lerp(124, 96, k);
  } else if (pose === 'back') {
    top = lerp(62, 80, k);
    bot = lerp(62, 56, k);
    hgt = lerp(124, 100, k);
  } else if (pose === 'left') {
    rot = -0.34 * k;
    top = lerp(62, 50, k);
    hgt = lerp(124, 104, k);
  }
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-top / 2, -hgt / 2);
  ctx.lineTo(top / 2, -hgt / 2);
  ctx.lineTo(bot / 2, hgt / 2);
  ctx.lineTo(-bot / 2, hgt / 2);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#1b1433';
  ctx.stroke();
  ctx.fillStyle = '#1b1433';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-top / 2 + 3, -hgt / 2 + 6);
  ctx.lineTo(top / 2 - 3, -hgt / 2 + 6);
  ctx.lineTo(bot / 2 - 3, hgt / 2 - 6);
  ctx.lineTo(-bot / 2 + 3, hgt / 2 - 6);
  ctx.closePath();
  ctx.fillStyle = '#7cc36a';
  ctx.fill();
  ctx.fillStyle = '#727987';
  ctx.fillRect(-10, -hgt / 2 + 6, 20, hgt - 12);
  ctx.restore();
}
function arrow(ctx, x, y, ang, len, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,12,30,0.9)';
  ctx.lineWidth = 13;
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.moveTo(-13, -len + 15);
    ctx.lineTo(0, -len);
    ctx.lineTo(13, -len + 15);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
  }
  ctx.restore();
}

export class Intro {
  constructor(o) {
    Object.assign(this, o);
    this.i = 0;
    this.t = 0;
    this.raf = 0;
    this.lines = o.story.intro;
    this.sven = o.story.narrator.look;
    this.next.addEventListener('click', () => this.step(1));
    this.skip.addEventListener('click', () => this.finish());
  }

  play(done) {
    this.done = done;
    this.i = 0;
    this.dots.textContent = '';
    for (let k = 0; k < this.lines.length; k++) this.dots.append(document.createElement('i'));
    this.showLine();
    let prev = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      this.t += dt;
      this.talk = Math.max(0, this.talk - dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  showLine() {
    const line = this.lines[this.i];
    this.t = 0;
    this.text.textContent = line.text;
    this.talk = Math.min(3.2, line.text.length / 22);
    this.next.textContent = this.i === this.lines.length - 1 ? "Let's go!" : 'Next';
    [...this.dots.children].forEach((d, k) => d.classList.toggle('on', k <= this.i));
    if (this.sound) this.sound.bark(0, 0.8);
  }

  step(dir) {
    if (this.sound) {
      this.sound.unlock();
      this.sound.play('click');
    }
    this.i += dir;
    if (this.i >= this.lines.length) return this.finish();
    this.showLine();
  }

  finish() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.done) this.done();
  }

  draw() {
    const cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const line = this.lines[this.i];
    const S = Math.max(0.95, Math.min(1.7, h / 400));
    const fn = this['s_' + line.scene];
    if (fn) fn.call(this, ctx, w, h, this.t, S, line.phase);
    // Sven's face beside the speech bubble
    const f = this.face.getContext('2d');
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, 160, 160);
    f.translate(80, 74);
    A.drawDogFace(f, this.sven, 58, { collar: '#e5383b', t: this.t, mouth: this.talk > 0 && Math.sin(this.t * 18) > 0 ? 'open' : 'closed' });
  }

  dog(id) {
    return this.dogDefs[id];
  }

  // ---- scenes -------------------------------------------------------------
  s_hello(ctx, w, h, t, S) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.45, h * 0.8);
    g.addColorStop(0, '#ffe8a3');
    g.addColorStop(1, '#f4a259');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.15;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.47);
      ctx.arc(w / 2, h * 0.47, h, a, a + 0.13);
      ctx.closePath();
      ctx.fill();
    }
    const pop = ease(seg(t, 0, 0.5));
    put(ctx, w / 2, h * 0.47 + Math.sin(t * 2.2) * 4, Math.sin(t * 1.6) * 0.04, pop, () => A.drawDogFace(ctx, this.sven, Math.min(w, h) * 0.3, { collar: '#e5383b', t }));
    label(ctx, w / 2, h * 0.1, 'HOW TO PLAY', '#fff', 22 * S, pop);
  }

  s_heist(ctx, w, h, t, S) {
    t %= 5.2;
    ctx.fillStyle = '#7cc36a';
    ctx.fillRect(0, 0, w, h);
    // porch
    ctx.fillStyle = '#c9a36b';
    ctx.fillRect(0, 0, w, h * 0.42);
    ctx.strokeStyle = '#a57f48';
    ctx.lineWidth = 3;
    for (let x = 0; x < w; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h * 0.42);
      ctx.stroke();
    }
    const mx = w / 2, my = h * 0.25;
    ctx.fillStyle = '#b5443c';
    ctx.fillRect(mx - 62 * S, my - 30 * S, 124 * S, 60 * S);
    ctx.strokeStyle = '#fff3';
    ctx.strokeRect(mx - 54 * S, my - 22 * S, 108 * S, 44 * S);
    const grab = t > 1.5;
    if (!grab) {
      const b = 1 + Math.sin(t * 6) * 0.06;
      put(ctx, mx, my, 0, S * 2.2 * b, () => {
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 7.5, 0, 0, TAU);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        ctx.strokeStyle = A.OUT;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        A.star(ctx, 0, 0, 4.5);
        ctx.fillStyle = '#fff3b0';
        ctx.fill();
      });
      label(ctx, mx, my - 50 * S, 'THE GOLDEN SQUEAKY', '#fff', 13 * S);
    }
    // the cat sneaks in from the right, grabs the toy, and bolts
    let cx, cy, rot, run = 0;
    if (t < 1.5) {
      const k = ease(seg(t, 0.2, 1.4));
      cx = lerp(w + 50, mx + 26 * S, k);
      cy = my;
      rot = -Math.PI / 2;
      run = t * 9;
    } else if (t < 2) {
      cx = mx + 26 * S;
      cy = my;
      rot = -Math.PI / 2 + seg(t, 1.5, 2) * (Math.PI / 2);
    } else {
      const k = seg(t, 2, 3.1);
      cx = mx + 26 * S + Math.sin(k * 5) * 30;
      cy = lerp(my, -70, k * k);
      rot = 0;
      run = t * 24;
    }
    put(ctx, cx, cy, rot, S * 1.5, () => A.drawCatTop(ctx, { state: 'run', run, t, toy: grab }));
    if (t > 1.5 && t < 2.3) label(ctx, mx, my + 54 * S, 'YOINK!', '#ffd23f', 26 * S, 1 - seg(t, 1.9, 2.3));
    // four dogs notice, then give chase
    const ids = ['zazu', 'pitbull', 'corgi', 'husky'];
    ids.forEach((id, i) => {
      const x = w * (0.2 + i * 0.2);
      const go = seg(t, 2.5 + i * 0.12, 4.4);
      const y = lerp(h * 0.82, -80, go * go);
      const d = this.dog(id);
      put(ctx, x, y, 0, S * d.size, () => A.drawDogTop(ctx, d.look, { run: go > 0 ? t * 22 + i : 0, speed: go > 0 ? 1 : 0, collar: this.slotColors[i], t, tongue: go > 0 }));
      if (t > 1.7 && go === 0) label(ctx, x, y - 62 * S, '!', '#ff3b3b', 30 * S);
    });
    if (t > 2.6 && t < 4.4) label(ctx, w / 2, h * 0.6, 'CHASE THE CAT!', '#fff', 26 * S, 1 - seg(t, 4, 4.4));
  }

  s_tilt(ctx, w, h, t, S, phase) {
    const pulse = phase === 'stay' ? 0 : ease(0.5 - 0.5 * Math.cos((t % 2.4) / 2.4 * TAU));
    const scroll = phase === 'forward' || phase === 'left' ? t * 240 : phase === 'back' ? -t * 110 : 0;
    const { rx, rw } = field(ctx, w, h, scroll * (phase === 'stay' ? 0 : 0.2 + pulse * 0.8));
    const d = this.dog('zazu');
    const dx = rx + rw * 0.72 + (phase === 'left' ? -pulse * rw * 0.2 : 0);
    const dy = h * 0.58;
    const rot = phase === 'left' ? -0.6 * pulse : 0;
    const moving = phase !== 'stay' && pulse > 0.1;
    put(ctx, dx, dy, rot, S * d.size * 1.25, () => A.drawDogTop(ctx, d.look, {
      run: moving ? t * (phase === 'back' ? -12 : 22) : 0, speed: moving ? (phase === 'back' ? 0.4 : pulse) : 0,
      collar: this.slotColors[0], t, tongue: phase !== 'back' && pulse > 0.6, wag: phase === 'stay' ? Math.sin(t * 10) * 0.6 : undefined
    }));
    if (phase === 'forward') arrow(ctx, dx, dy - 70 * S, 0, 44 * S, '#ffd23f');
    if (phase === 'left') arrow(ctx, dx - 40 * S, dy - 60 * S, -0.7, 44 * S, '#ffd23f');
    if (phase === 'back') arrow(ctx, dx, dy + 74 * S, Math.PI, 36 * S, '#ffd23f');
    if (phase === 'stay') label(ctx, dx, dy - 78 * S, 'STAY', '#fff', 24 * S);
    // the phone, tilting
    const px = Math.max(58 * S, rx + 44 * S), py = h * 0.4;
    ctx.fillStyle = 'rgba(27,20,51,0.55)';
    ctx.beginPath();
    ctx.ellipse(px, py, 62 * S, 88 * S, 0, 0, TAU);
    ctx.fill();
    phone(ctx, px, py, phase, pulse, S * 0.95);
    const word = { forward: 'TIP FORWARD', left: 'LEAN LEFT', stay: 'HOLD STEADY', back: 'TIP BACK' }[phase];
    label(ctx, px, py + 98 * S, word, '#ffd23f', 14 * S);
  }

  s_thumb(ctx, w, h, t, S) {
    const a = t * 1.4;
    const vx = Math.cos(a) * 0.9, vy = Math.sin(a * 0.7) * 0.5 - 0.5;
    const { rx, rw } = field(ctx, w, h, t * 180);
    const d = this.dog('zazu');
    const dx = rx + rw / 2 + vx * rw * 0.3, dy = h * 0.36 + vy * h * 0.1;
    put(ctx, dx, dy, vx * 0.6, S * d.size * 1.2, () => A.drawDogTop(ctx, d.look, { run: t * 22, speed: 1, collar: this.slotColors[0], t, tongue: true }));
    const jx = w / 2, jy = h * 0.78, R = 46 * S;
    ctx.beginPath();
    ctx.arc(jx, jy, R, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(jx + vx * R * 0.8, jy + vy * R * 0.8, 21 * S, 0, TAU);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = '#1b1433';
    ctx.lineWidth = 3;
    ctx.stroke();
    label(ctx, jx, jy + R + 20 * S, 'DRAG ANYWHERE', '#fff', 14 * S);
  }

  s_water(ctx, w, h, t, S) {
    t %= 4.4;
    const { rx, rw } = field(ctx, w, h, 0);
    const py = h * 0.45;
    puddle(ctx, rx + rw / 2, py, rw * 0.46, h * 0.17, t);
    const run = (id, x, slot, speedIn) => {
      const d = this.dog(id);
      // Outside the water both dogs run alike; inside, one crawls and one cruises.
      const top = py - h * 0.17, bot = py + h * 0.17;
      const start = h + 60, end = -80;
      let y = start, tt = t * 300, wet = false;
      const lead = start - bot;
      if (tt < lead) y = start - tt;
      else {
        tt -= lead;
        const inside = (bot - top) / speedIn;
        if (tt < inside) {
          y = bot - tt * speedIn;
          wet = true;
        } else y = top - (tt - inside);
      }
      if (y < end) return;
      if (wet) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y, 30 * S + Math.sin(t * 10) * 3, 38 * S, 0, 0, TAU);
        ctx.stroke();
      }
      put(ctx, x, y, 0, S * d.size * 1.1, () => A.drawDogTop(ctx, d.look, { run: t * (wet && speedIn < 0.6 ? 9 : 22), speed: wet ? speedIn : 1, collar: this.slotColors[slot], t, tongue: !wet || speedIn > 0.6 }));
      if (wet) label(ctx, x, y - 58 * S, speedIn < 0.6 ? 'SLOOOW' : 'WHEEE!', speedIn < 0.6 ? '#bfe6ff' : '#ffd23f', 15 * S);
    };
    run('pitbull', rx + rw * 0.3, 0, 0.42);
    run('labrador', rx + rw * 0.7, 1, 0.9);
  }

  s_kids(ctx, w, h, t, S) {
    t %= 5;
    const { rx, rw } = field(ctx, w, h, t < 1.4 || t > 3.4 ? t * 60 : 0);
    const kx = rx + rw * 0.74, ky = h * 0.34;
    const d = this.dog('zazu');
    let x, y, rot = 0, hug = 0;
    const lane = rx + rw * 0.36;
    if (t < 1.4) {
      x = lane;
      y = lerp(h + 60, h * 0.6, seg(t, 0, 1.4));
    } else if (t < 2.1) {
      const k = ease(seg(t, 1.4, 2.1));
      x = lerp(lane, kx, k);
      y = lerp(h * 0.6, ky + 62 * S, k);
      rot = 0.8 * Math.sin(k * Math.PI);
    } else if (t < 3.4) {
      x = kx;
      y = ky + 62 * S;
      hug = 1;
    } else {
      const k = seg(t, 3.4, 4.6);
      x = lerp(kx, lane, ease(Math.min(1, k * 2)));
      y = lerp(ky + 62 * S, -90, k * k);
      rot = -0.5 * Math.sin(Math.min(1, k * 2) * Math.PI);
    }
    // the circle that pulls a dog in
    ctx.beginPath();
    ctx.arc(kx, ky, 78 * S, 0, TAU);
    ctx.strokeStyle = 'rgba(255,107,139,0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 8]);
    ctx.lineDashOffset = -t * 30;
    ctx.stroke();
    ctx.setLineDash([]);
    const kid = () => put(ctx, kx, ky, 0, S * 1.7, () => A.drawKid(ctx, { skin: '#c98d62', hair: '#2b1d14', shirt: '#4dabf7', style: 1 }, { t, hug }));
    if (!hug) kid();
    put(ctx, x, y, rot, S * d.size * 1.1, () => A.drawDogTop(ctx, d.look, { run: hug ? 0 : t * 22, speed: hug ? 0 : 1, collar: this.slotColors[0], t, mood: hug || t > 3.4 ? 'happy' : null, wag: hug ? Math.sin(t * 16) * 0.7 : undefined }));
    if (hug) kid();
    if (hug) hearts(ctx, kx, ky - 10, t, 6, 60 * S);
    // Love meter
    const mw = Math.min(w * 0.6, 220), mxx = (w - mw) / 2, myy = h * 0.88;
    const fill = t < 2.1 ? 0.3 : lerp(0.3, 0.85, ease(seg(t, 2.1, 3.3)));
    ctx.fillStyle = 'rgba(27,20,51,0.8)';
    ctx.fillRect(mxx - 4, myy - 4, mw + 8, 22);
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(mxx, myy, mw * fill, 14);
    label(ctx, w / 2, myy - 18, 'LOVE', '#ffb3c6', 14 * S);
    if (t > 3.3 && t < 4.4) label(ctx, w / 2, h * 0.62, 'HAPPY TAIL SPEED BOOST!', '#ffd23f', 15 * S, 1 - seg(t, 4, 4.4));
  }

  s_badowner(ctx, w, h, t, S) {
    t %= 5.4;
    const { rx, rw } = field(ctx, w, h, 0);
    const vx = rx + 34 * S, vy = h * 0.36;
    const eaten = t > 2.5;
    const def = this.villains.types.hoser;
    const d = this.dog('pitbull');
    // cage with a pup
    put(ctx, rx - 26 * S, vy + 6, 0, S * 1.5, () => A.drawCage(ctx, eaten, t, 2));
    // hose jet sweeping
    if (!eaten) {
      const ang = Math.sin(t * 2.4) * 0.6 - 0.1;
      const len = rw * 0.72;
      ctx.strokeStyle = 'rgba(120,200,255,0.6)';
      ctx.lineWidth = 30 * S;
      ctx.beginPath();
      ctx.moveTo(vx + 24 * S, vy);
      ctx.lineTo(vx + 24 * S + Math.cos(ang) * len, vy - Math.sin(ang) * len);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,250,255,0.95)';
      ctx.lineWidth = 9 * S;
      ctx.setLineDash([20, 14]);
      ctx.lineDashOffset = -t * 300;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    let x = vx, y;
    if (t < 2.5) y = lerp(h + 70, vy + 44 * S, ease(seg(t, 0.6, 2.5)));
    else if (t < 3.3) y = vy + 30 * S;
    else y = lerp(vy + 30 * S, -100, Math.pow(seg(t, 3.3, 4.8), 2));
    if (!eaten) {
      put(ctx, vx, vy, 0, S * 1.5, () => A.drawVillain(ctx, def.look, { t }));
      label(ctx, vx + 60 * S, vy - 54 * S, 'BAD OWNER', '#ff6b6b', 14 * S);
    } else if (t < 2.8) {
      const k = seg(t, 2.5, 2.8);
      put(ctx, vx, lerp(vy, y, k), k * 5, S * 1.5 * (1 - k * 0.9), () => A.drawVillain(ctx, def.look, { t, flinch: 1 }));
    }
    // freed pup trots along behind
    if (t > 2.9) {
      const k = seg(t, 2.9, 3.4);
      put(ctx, lerp(rx - 26 * S, x, k), lerp(vy + 6, y + 56 * S, k), 0, S * 1.3, () => A.drawPup(ctx, 2, { run: t * 26, speed: 0.9 }));
    }
    put(ctx, x, y, 0, S * d.size * 1.15, () => A.drawDogTop(ctx, d.look, { run: t < 2.5 || t > 3.3 ? t * 22 : 0, speed: t < 2.5 || t > 3.3 ? 1 : 0, collar: this.slotColors[0], t, belly: t > 2.6 && t < 3.6 ? 1 : 0, tongue: t < 2.5 }));
    if (eaten && t < 3.9) {
      const a = 1 - seg(t, 3.4, 3.9);
      label(ctx, w / 2, h * 0.5, 'CHOMP!', '#ffd23f', 44 * S, a);
      label(ctx, w / 2, h * 0.5 + 42 * S, '+2,500', '#fff', 24 * S, a);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU, r = (t - 2.5) * 130 * S;
        ctx.globalAlpha = a;
        A.star(ctx, vx + Math.cos(ang) * r, vy + Math.sin(ang) * r, 8 * S);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (t > 3.2 && t < 4.6) label(ctx, w / 2, h * 0.84, 'PUP RESCUED!', '#9be7ff', 18 * S, 1 - seg(t, 4.2, 4.6));
  }

  s_zoom(ctx, w, h, t, S) {
    t %= 4.6;
    const zooming = t > 1.6 && t < 3.8;
    const { rx, rw } = field(ctx, w, h, t * (zooming ? 620 : 220));
    puddle(ctx, rx + rw / 2, ((t * (zooming ? 620 : 220)) % (h + 300)) - 150, rw * 0.36, 46 * S, t);
    const d = this.dog('zazu');
    const x = rx + rw / 2 + Math.sin(t * 2) * rw * 0.12, y = h * (zooming ? 0.5 : 0.6);
    if (zooming) {
      for (let i = 0; i < 9; i++) {
        const k = (t * 5 + i / 9) % 1;
        ctx.strokeStyle = ['#ffd23f', '#ff9f1c', '#fff'][i % 3];
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 5 * S * (1 - k);
        ctx.beginPath();
        const sx = x + (i - 4) * 7 * S;
        ctx.moveTo(sx, y + 30 * S + k * 110 * S);
        ctx.lineTo(sx, y + 60 * S + k * 110 * S);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const rk = seg(t, 1.6, 2.1);
      if (rk < 1) {
        ctx.beginPath();
        ctx.arc(x, y, 30 + rk * 240 * S, 0, TAU);
        ctx.strokeStyle = `rgba(255,210,63,${1 - rk})`;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
    }
    put(ctx, x, y, Math.cos(t * 2) * 0.15, S * d.size * (zooming ? 1.3 : 1.2), () => A.drawDogTop(ctx, d.look, { run: t * (zooming ? 34 : 20), speed: 1, collar: this.slotColors[0], t, tongue: true }));
    if (zooming) label(ctx, w / 2, h * 0.2, 'ZOOMIES!', '#ffd23f', (34 + Math.sin(t * 16) * 3) * S);
    // energy pips fill, then one is spent
    const e = t < 1.6 ? lerp(1, 3, ease(seg(t, 0.2, 1.4))) : t < 3.8 ? 2 : lerp(2, 2.2, seg(t, 3.8, 4.6));
    for (let i = 0; i < 3; i++) {
      const cx = w / 2 + (i - 1) * 40 * S, cy = h * 0.9, f = c01(e - i);
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * S, 0, TAU);
      ctx.fillStyle = 'rgba(27,20,51,0.8)';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(cx - 14 * S, cy + 14 * S - 28 * S * f, 28 * S, 28 * S * f);
      ctx.restore();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    label(ctx, w / 2, h * 0.9 - 30 * S, 'ENERGY', '#fff', 13 * S);
  }

  s_finish(ctx, w, h, t, S) {
    t %= 5;
    const { rx, rw } = field(ctx, w, h, 0);
    const fy = h * 0.5;
    const cw = rw / 10;
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = (i + r) % 2 ? '#1d1d24' : '#f8f9fa';
        ctx.fillRect(rx + i * cw, fy + r * 12 * S, cw + 0.5, 12 * S + 0.5);
      }
    }
    const tx = w / 2, ty = h * 0.2;
    ctx.beginPath();
    ctx.ellipse(tx, ty, 84 * S, 62 * S, 0, 0, TAU);
    ctx.fillStyle = '#2f9e44';
    ctx.fill();
    ctx.strokeStyle = A.OUT;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#40c057';
    ctx.beginPath();
    ctx.arc(tx - 26 * S, ty - 14 * S, 30 * S, 0, TAU);
    ctx.arc(tx + 30 * S, ty + 6 * S, 24 * S, 0, TAU);
    ctx.fill();
    const ck = seg(t, 0, 1.3);
    if (ck < 1) put(ctx, tx + Math.sin(ck * 6) * 20, lerp(h + 40, ty, ck), 0, S * 1.5, () => A.drawCatTop(ctx, { state: 'run', run: t * 24, t }));
    else put(ctx, tx, ty, 0, S * 1.7, () => A.drawCatTop(ctx, { state: 'sit', t }));
    const ids = ['zazu', 'greyhound', 'shepherd', 'chihuahua'];
    ids.forEach((id, i) => {
      const d = this.dog(id);
      const k = seg(t, 0.5 + i * 0.35, 2 + i * 0.4);
      const x = rx + rw * (0.2 + i * 0.2);
      const y = lerp(h + 60 + i * 30, fy - 56 * S - (i === 0 ? 20 * S : 0), ease(k));
      const there = k >= 1;
      put(ctx, x, y + (there ? Math.abs(Math.sin(t * 8 + i)) * -6 : 0), 0, S * d.size, () => A.drawDogTop(ctx, d.look, { run: there ? 0 : t * 22 + i, speed: there ? 0 : 1, collar: this.slotColors[i], t, tongue: true, wag: there ? Math.sin(t * 14 + i) * 0.7 : undefined }));
      if (there && i === 0) label(ctx, x, y + 56 * S, '1st!', '#ffd23f', 24 * S);
    });
    if (t > 2.2) {
      for (let i = 0; i < 26; i++) {
        const k = ((t - 2.2) * 0.5 + i * 0.137) % 1;
        ctx.fillStyle = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#da77f2'][i % 5];
        ctx.fillRect((i * 97) % w, k * h, 8, 5);
      }
    }
  }
}
