// Draws a Race onto the canvas and turns race events into particles and floating text.

import * as A from './art.js';

const TAU = Math.PI * 2;
export const FONT = "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif";
const fmt = (n) => n.toLocaleString('en-US');
const HIT_WORD = { soak: 'SOAKED!', net: 'NETTED!', cower: 'EEK!', spook: 'BOOM!' };

function roundBox(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.shake = 0;
    this.t = 0;
    this.cam = -60;
    this.flash = 0;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.dpr = dpr;
    const W = Math.round(this.w * dpr), H = Math.round(this.h * dpr);
    if (this.cv.width !== W || this.cv.height !== H) {
      this.cv.width = W;
      this.cv.height = H;
    }
  }

  setRace(race, opts) {
    this.race = race;
    this.local = opts.localSlot;
    this.colors = opts.slotColors;
    this.parts.length = 0;
    this.cam = -60;
    this.goT = -1;
    this.shake = 0;
    this.flash = 0;
  }

  // ------------------------------------------------------------ particles
  p(o) {
    if (this.parts.length > 420) this.parts.shift();
    this.parts.push(Object.assign({ vx: 0, vy: 0, life: 0.6, age: 0, size: 4, kind: 'dot', color: '#fff', drag: 0.9, g: 0 }, o));
  }
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = (o.speed || 160) * (0.4 + Math.random() * 0.8);
      this.p(Object.assign({}, o, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (o.life || 0.6) * (0.6 + Math.random() * 0.6) }));
    }
  }
  text(x, y, str, color = '#fff', size = 22, life = 1.1) {
    // keep words on the track even when the action is at the edge
    const half = str.length * size * 0.33, W = this.race ? this.race.W : 480;
    x = Math.max(half - 20, Math.min(W - half + 20, x));
    this.p({ kind: 'text', x, y, vy: 70, str, color, size, life, drag: 0.94 });
  }

  onEvent(ev) {
    const mine = ev.slot === this.local;
    switch (ev.type) {
      case 'go':
        this.goT = 0;
        break;
      case 'splash':
        this.burst(ev.x, ev.y, 9, { color: '#bfe6ff', size: 4, speed: 150, life: 0.5 });
        this.p({ kind: 'ring', x: ev.x, y: ev.y, size: 14, grow: 90, color: 'rgba(255,255,255,0.8)', life: 0.5 });
        break;
      case 'bone':
        this.burst(ev.x, ev.y, 4, { kind: 'star', color: '#fff3b0', size: 5, speed: 90, life: 0.4 });
        if (mine) this.text(ev.x, ev.y + 14, '+' + ev.pts, '#fff3b0', 15, 0.7);
        break;
      case 'hugstart':
        this.burst(ev.x, ev.y, 5, { kind: 'heart', color: '#ff6b8b', size: 7, speed: 70, life: 0.9 });
        break;
      case 'hug':
        this.burst(ev.x, ev.y, 12, { kind: 'heart', color: '#ff6b8b', size: 8, speed: 150, life: 1 });
        if (mine) this.text(ev.x, ev.y + 30, 'HUG! +' + fmt(ev.pts), '#ffb3c6', 22);
        break;
      case 'chomp':
        this.burst(ev.x, ev.y, 14, { kind: 'star', color: '#ffd23f', size: 8, speed: 260, life: 0.7 });
        this.p({ kind: 'puff', x: ev.x, y: ev.y, size: 20, grow: 110, color: 'rgba(255,255,255,0.9)', life: 0.45 });
        this.text(ev.x, ev.y + 34, 'CHOMP!', '#ffd23f', mine ? 34 : 22, 1.2);
        if (mine) {
          this.text(ev.x, ev.y + 4, '+' + fmt(ev.pts), '#fff', 22, 1.2);
          if (ev.combo > 1) this.text(ev.x, ev.y - 22, 'COMBO x' + ev.combo, '#ff9f1c', 18, 1.2);
          this.kick(9);
        }
        break;
      case 'bosshit':
      case 'bossdown':
        this.burst(ev.x, ev.y, 22, { kind: 'star', color: '#ffd23f', size: 10, speed: 320, life: 0.9 });
        this.p({ kind: 'puff', x: ev.x, y: ev.y, size: 30, grow: 180, color: 'rgba(255,255,255,0.9)', life: 0.5 });
        this.text(ev.x, ev.y + 40, ev.type === 'bossdown' ? 'GULP!' : 'CHOMP!', '#ffd23f', 38, 1.3);
        if (mine) this.text(ev.x, ev.y + 4, '+' + fmt(ev.pts), '#fff', 24, 1.3);
        this.kick(14);
        if (ev.type === 'bossdown') {
          for (let i = 0; i < 40; i++) {
            this.p({ kind: 'confetti', x: ev.x + (Math.random() - 0.5) * 300, y: ev.y + Math.random() * 300, vx: (Math.random() - 0.5) * 200, vy: -80 - Math.random() * 160, color: ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#da77f2'][i % 5], size: 7, life: 1.8, drag: 0.98 });
          }
        }
        break;
      case 'hit':
        this.burst(ev.x, ev.y, 7, { kind: 'star', color: ev.kind === 'soak' ? '#bfe6ff' : '#ff8787', size: 6, speed: 180, life: 0.5 });
        if (mine) {
          this.text(ev.x, ev.y + 30, HIT_WORD[ev.kind] || 'OUCH!', '#ff8787', 24);
          this.kick(8);
          this.flash = 0.35;
        }
        break;
      case 'free':
        this.burst(ev.x, ev.y, 8, { color: '#fff', size: 4, speed: 200, life: 0.4 });
        break;
      case 'knock':
        this.burst(ev.x, ev.y, 5, { color: '#dee2e6', size: 4, speed: 150, life: 0.4 });
        break;
      case 'bonk':
        this.burst(ev.x, ev.y, 3, { kind: 'star', color: '#fff', size: 6, speed: 120, life: 0.4 });
        break;
      case 'zoom':
        this.p({ kind: 'ring', x: ev.x, y: ev.y, size: 20, grow: 420, color: 'rgba(255,210,63,0.95)', life: 0.5, lw: 7 });
        this.text(ev.x, ev.y + 44, mine ? 'ZOOMIES!' : 'WOOF!', '#ffd23f', mine ? 26 : 18, 0.9);
        break;
      case 'yell':
        this.text(ev.x, ev.y + 34, 'HEY!!', '#ff6b6b', 22, 0.8);
        break;
      case 'windup':
        this.text(ev.x, ev.y + 34, '!', '#ff3b3b', 34, 0.5);
        break;
      case 'pop':
        this.burst(ev.x, ev.y, 16, { kind: 'star', color: '#ffb703', size: 8, speed: 300, life: 0.5 });
        this.p({ kind: 'puff', x: ev.x, y: ev.y, size: 24, grow: 200, color: 'rgba(255,236,170,0.95)', life: 0.35 });
        this.kick(6);
        break;
      case 'tag':
        this.burst(ev.x, ev.y, 14, { kind: 'star', color: '#fff', size: 8, speed: 240, life: 0.7 });
        this.text(ev.x, ev.y + 34, 'TAG!' + (mine ? ' +' + fmt(ev.pts) : ''), '#9be7ff', mine ? 28 : 20, 1.2);
        break;
      case 'cat':
        if (ev.kind === 'alert') this.text(ev.x, ev.y + 30, '!', '#fff', 30, 0.5);
        else this.p({ kind: 'puff', x: ev.x, y: ev.y, size: 12, grow: 80, color: 'rgba(255,255,255,0.8)', life: 0.4 });
        break;
      case 'finish':
        if (mine) {
          const d = this.race.dogs[ev.slot];
          for (let i = 0; i < 46; i++) {
            this.p({ kind: 'confetti', x: d.x + (Math.random() - 0.5) * 420, y: d.y + 260 + Math.random() * 220, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 180, color: ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#da77f2'][i % 5], size: 7, life: 2.2, drag: 0.985 });
          }
        }
        break;
    }
  }

  kick(n) {
    if (!this.reduced) this.shake = Math.max(this.shake, n);
  }

  // ------------------------------------------------------------ frame
  frame(dt) {
    const race = this.race;
    if (!race) return;
    this.t += dt;
    const ctx = this.ctx, T = race.track, th = T.world.theme;
    const s = this.w / (T.W + T.margin * 2);
    const viewH = this.h / s;
    const me = race.dogs[this.local] || race.dogs[0];
    let target = me.y - viewH * 0.27;
    if (race.phase === 'count') target = -70;
    target = Math.min(target, T.length - viewH + 40);
    this.cam += (target - this.cam) * Math.min(1, 7 * dt);
    if (this.goT >= 0) this.goT += dt;
    this.shake *= Math.pow(0.02, dt);
    if (this.flash > 0) this.flash -= dt;
    const shx = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0;
    const dpr = this.dpr;
    const y0 = this.cam - 120, y1 = this.cam + viewH + 120;
    this.y0 = y0;
    this.y1 = y1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = th.ground;
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    // World space: x right, y up the screen.
    ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * (T.margin * s + shx), dpr * (this.h + this.cam * s + shy));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    this.ground(ctx, T, th, y0, y1);
    this.water(ctx, T, th, y0, y1);
    this.marks(ctx, T, th, y0, y1);
    this.telegraphs(ctx, race, y0, y1);
    this.solids(ctx, T, th, y0, y1);

    for (const b of T.bones) {
      if (b.taken || b.y < y0 || b.y > y1) continue;
      this.at(b.x, b.y + Math.sin(this.t * 4 + b.id) * 2, 0, () => A.drawBone(ctx, 1.45, 0.6 + Math.sin(this.t * 5 + b.id) * 0.4));
    }
    for (const k of T.knocks) {
      if (k.y < y0 - 300 || k.y > y1 + 300 || k.t > 0.9) continue;
      ctx.globalAlpha = k.hit ? Math.max(0, 1 - k.t / 0.9) : 1;
      this.at(k.x, k.y, k.hit ? k.t * 14 : 0, () => A.drawProp(ctx, k.kind), 1.45);
      ctx.globalAlpha = 1;
    }
    this.kids(ctx, race, y0, y1, false);
    this.villains(ctx, race, y0, y1);
    this.pups(ctx, race, y0, y1);
    this.dogs(ctx, race, me, dt);
    this.kids(ctx, race, y0, y1, true);
    this.cat(ctx, race);
    this.finishTree(ctx, race, T);
    this.particles(ctx, dt);
    this.decor(ctx, T, th, y0, y1, false);

    // Screen space from here on.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (th.night > 0) {
      ctx.fillStyle = `rgba(14,18,48,${th.night * 0.55})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * (T.margin * s + shx), dpr * (this.h + this.cam * s + shy));
      this.decor(ctx, T, th, y0, y1, true);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.flash > 0) {
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.25, this.w / 2, this.h / 2, this.h * 0.75);
      g.addColorStop(0, 'rgba(255,60,60,0)');
      g.addColorStop(1, `rgba(255,60,60,${Math.min(0.5, this.flash * 1.4)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    this.countdown(ctx, race);
  }

  // Draw a sprite at a world point. Sprites use screen-style axes (y down).
  at(x, y, rot, fn, sc = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, -sc);
    if (rot) ctx.rotate(rot);
    fn();
    ctx.restore();
  }
  label(x, y, str, color, size, alpha = 1, stroke = 'rgba(20,12,30,0.85)') {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, -1);
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.22;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  ground(ctx, T, th, y0, y1) {
    const W = T.W, wid = T.world.id;
    // mowing or paving bands outside the track
    for (let y = Math.floor(y0 / 240) * 240; y < y1; y += 240) {
      if ((Math.floor(y / 240) & 1) === 0) continue;
      ctx.fillStyle = th.groundDark;
      ctx.fillRect(-T.margin - 20, y, W + T.margin * 2 + 40, 240);
    }
    ctx.fillStyle = th.track;
    ctx.fillRect(0, y0, W, y1 - y0);
    ctx.fillStyle = th.trackAlt;
    for (let y = Math.floor(y0 / 320) * 320; y < y1; y += 320) ctx.fillRect(0, y, W, 160);
    if (wid === 1 || wid === 3) {
      ctx.fillStyle = th.line;
      for (let y = Math.floor(y0 / 150) * 150; y < y1; y += 150) {
        ctx.fillRect(157, y, 6, 64);
        ctx.fillRect(317, y, 6, 64);
      }
    } else if (wid === 2) {
      ctx.fillStyle = th.line;
      for (let y = Math.floor(y0 / 70) * 70; y < y1; y += 70) {
        const h = Math.abs(Math.sin(y * 12.9898) * 43758.5453) % 1;
        ctx.beginPath();
        ctx.ellipse(30 + h * (W - 60), y + h * 40, 5 + h * 4, 4 + h * 3, 0, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = th.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      ctx.fillStyle = th.edge;
      for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
        for (const x of [14, 160, 320, W - 14]) ctx.fillRect(x - 2, y + 21, 4, 4);
      }
    }
    ctx.fillStyle = th.edge;
    ctx.fillRect(-12, y0, 12, y1 - y0);
    ctx.fillRect(W, y0, 12, y1 - y0);
  }

  water(ctx, T, th, y0, y1) {
    const t = this.t;
    for (const w of T.waters) {
      if (w.y1 < y0 || w.y0 > y1) continue;
      if (w.shape === 'e') {
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, w.rx + 5, w.ry + 5, 0, 0, TAU);
        ctx.fillStyle = th.waterDark;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, TAU);
        ctx.fillStyle = th.water;
        ctx.fill();
        ctx.strokeStyle = th.waterLight;
        ctx.lineWidth = 2.4;
        for (let i = 0; i < 2; i++) {
          const k = ((t * 0.35 + i * 0.5 + w.id * 0.13) % 1);
          ctx.globalAlpha = 0.7 * (1 - k);
          ctx.beginPath();
          ctx.ellipse(w.x, w.y, w.rx * (0.25 + k * 0.65), w.ry * (0.25 + k * 0.65), 0, 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = th.waterDark;
        ctx.fillRect(w.x0, w.y0 - 6, w.x1 - w.x0, w.y1 - w.y0 + 12);
        ctx.fillStyle = th.water;
        ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
        ctx.strokeStyle = th.waterLight;
        ctx.lineWidth = 2.6;
        ctx.globalAlpha = 0.75;
        for (let yy = w.y0 + 24; yy < w.y1 - 10; yy += 34) {
          ctx.beginPath();
          const off = (t * 60 + yy * 3) % 120;
          for (let x = -60 - off; x < T.W + 80; x += 120) {
            ctx.moveTo(x, yy);
            ctx.quadraticCurveTo(x + 22, yy + 9, x + 46, yy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    for (const b of T.bridges) {
      if (b.y1 < y0 || b.y0 > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x0 + 5, b.y0 - 6, b.x1 - b.x0, b.y1 - b.y0);
      ctx.fillStyle = '#c69a62';
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.strokeStyle = '#8f6a3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let yy = b.y0 + 18; yy < b.y1; yy += 18) {
        ctx.moveTo(b.x0, yy);
        ctx.lineTo(b.x1, yy);
      }
      ctx.stroke();
      ctx.fillStyle = '#7a5630';
      ctx.fillRect(b.x0 - 5, b.y0, 7, b.y1 - b.y0);
      ctx.fillRect(b.x1 - 2, b.y0, 7, b.y1 - b.y0);
    }
  }

  checker(ctx, W, y, h, n) {
    const cw = W / n;
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = (i + r) % 2 ? '#1d1d24' : '#f8f9fa';
        ctx.fillRect(i * cw, y + (r * h) / 2, cw + 0.5, h / 2 + 0.5);
      }
    }
  }

  marks(ctx, T, th, y0, y1) {
    if (150 > y0 && 150 < y1 + 40) this.checker(ctx, T.W, 126, 20, 16);
    if (T.finishY > y0 - 60 && T.finishY < y1 + 60) {
      this.checker(ctx, T.W, T.finishY - 4, 34, 12);
      for (const x of [-6, T.W + 6]) {
        ctx.beginPath();
        ctx.arc(x, T.finishY + 12, 11, 0, TAU);
        ctx.fillStyle = '#e03131';
        ctx.fill();
        ctx.strokeStyle = A.OUT;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      this.label(T.W / 2, T.finishY + 62, 'FINISH', '#fff', 30, 0.9);
    }
    if (T.arenaY && T.arenaY > y0 && T.arenaY < y1) {
      ctx.fillStyle = 'rgba(224,49,49,0.85)';
      for (let x = 0; x < T.W; x += 48) ctx.fillRect(x, T.arenaY, 24, 12);
      this.label(T.W / 2, T.arenaY + 40, T.boss ? T.boss.def.name.toUpperCase() : 'BOSS', '#ff6b6b', 26, 0.95);
    }
  }

  telegraphs(ctx, race, y0, y1) {
    const t = this.t;
    for (const b of race.bombs) {
      const k = 1 - Math.max(0, b.t) / b.fuse;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fillStyle = `rgba(255,60,60,${0.16 + 0.22 * k})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,60,60,0.95)';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -t * 60;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(2, b.r * (1 - k)), 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      // the firecracker flying in from the thrower
      const fx = b.fx + (b.x - b.fx) * k, fy = b.fy + (b.y - b.fy) * k;
      this.at(fx, fy, t * 12, () => {
        ctx.fillStyle = '#e03131';
        ctx.strokeStyle = A.OUT;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.rect(-3, -9, 6, 18);
        ctx.fill();
        ctx.stroke();
        A.star(ctx, 0, -12, 4, 4);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
      }, 1 + Math.sin(k * Math.PI) * 0.8);
    }
    for (const g of race.rings) {
      const a = 1 - g.r / g.maxR;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, TAU);
      ctx.strokeStyle = `rgba(255,90,70,${0.35 + a * 0.6})`;
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(g.x, g.y, Math.max(1, g.r - 12), 0, TAU);
      ctx.strokeStyle = `rgba(255,220,120,${0.2 + a * 0.5})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    for (const v of race.track.villains) {
      if (!v.alive || v.y < y0 - 500 || v.y > y1 + 500) continue;
      const P = v.def;
      if (v.state === 'windup' && P.netR) {
        const reach = P.netR + v.r - 2;
        ctx.beginPath();
        ctx.arc(v.x + v.aimX * reach, v.y + v.aimY * reach, P.netR, 0, TAU);
        ctx.fillStyle = 'rgba(255,60,60,0.28)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,60,60,0.95)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      const jets = v.jets || (v.jet ? [v.jet] : null);
      if (jets) {
        for (const j of jets) {
          ctx.strokeStyle = 'rgba(120,200,255,0.55)';
          ctx.lineWidth = j.w;
          ctx.beginPath();
          ctx.moveTo(j.ox, j.oy);
          ctx.lineTo(j.ex, j.ey);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(235,250,255,0.95)';
          ctx.lineWidth = j.w * 0.34;
          ctx.setLineDash([26, 16]);
          ctx.lineDashOffset = -t * 420;
          ctx.stroke();
          ctx.setLineDash([]);
          if (Math.random() < 0.5) this.p({ x: j.ex, y: j.ey, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, color: '#d6f0ff', size: 4, life: 0.35 });
        }
      }
    }
  }

  solids(ctx, T, th, y0, y1) {
    const wid = T.world.id;
    for (const sld of T.solids) {
      if (!sld.active || sld.y < y0 - 60 || sld.y > y1 + 60) continue;
      const x = sld.x - sld.hw, y = sld.y - sld.hh, w = sld.hw * 2, h = sld.hh * 2;
      if (sld.kind === 'crate') {
        this.at(sld.x, sld.y, 0, () => A.drawProp(ctx, 'crate'), 1.3);
      } else if (sld.kind === 'hedge') {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + 4, y - 7, w, h);
        ctx.fillStyle = th.hedge;
        ctx.strokeStyle = A.OUT;
        ctx.lineWidth = 2.4;
        roundBox(ctx, x, y, w, h, wid <= 2 ? 16 : 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = th.hedgeDark;
        if (wid <= 2) {
          for (let xx = x + 16; xx < x + w - 8; xx += 30) {
            ctx.beginPath();
            ctx.arc(xx, sld.y + ((xx / 30) & 1 ? 6 : -6), 7, 0, TAU);
            ctx.fill();
          }
        } else {
          for (let xx = x + 6; xx < x + w - 20; xx += 32) {
            ctx.fillRect(xx, y + 6, 22, 12);
            ctx.fillRect(xx + 12, y + 26, 22, 12);
          }
        }
      } else if (sld.kind === 'gate') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, y - 10, T.W, h);
        ctx.fillStyle = '#343a46';
        ctx.fillRect(0, y, T.W, h);
        ctx.strokeStyle = '#aab0bd';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let xx = 10; xx < T.W; xx += 22) {
          ctx.moveTo(xx, y + 2);
          ctx.lineTo(xx, y + h - 2);
        }
        ctx.stroke();
        this.label(T.W / 2, sld.y + 44, 'LOCKED', '#ffd23f', 20, 0.9);
      } else if (sld.kind === 'chain') {
        ctx.strokeStyle = A.OUT;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(sld.ax, sld.y);
        ctx.lineTo(sld.bx, sld.y);
        ctx.stroke();
        ctx.strokeStyle = '#c3c9d4';
        ctx.lineWidth = 5.5;
        ctx.setLineDash([9, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // Kids in the middle of a hug are drawn after the dogs so their arms wrap over the dog.
  kids(ctx, race, y0, y1, hugging) {
    for (const k of race.track.kids) {
      if (k.y < y0 || k.y > y1) continue;
      let hug = 0;
      for (const d of race.dogs) if (d.hug && d.hug.kid === k) hug = Math.max(hug, Math.min(1, d.hug.t / (d.hug.dur * 0.5)));
      if (hug > 0 !== hugging) continue;
      const done = !!k.hugged[this.local];
      this.at(k.x, k.y, 0, () => A.drawKid(ctx, k.look, { t: this.t + k.wave, hug, done }), 1.9);
      if (!done && !hug) {
        const bob = Math.sin(this.t * 4 + k.wave) * 4;
        this.at(k.x, k.y + 52 + bob, 0, () => {
          A.heart(ctx, 0, 0, 10);
          ctx.fillStyle = '#ff6b8b';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        });
      }
      if (hug > 0 && Math.random() < 0.25) this.p({ kind: 'heart', x: k.x + (Math.random() - 0.5) * 30, y: k.y, vy: 90, color: '#ff6b8b', size: 6, life: 0.8 });
    }
  }

  villains(ctx, race, y0, y1) {
    const T = race.track, t = this.t;
    for (const v of T.villains) {
      if (v.y < y0 - 200 || v.y > y1 + 200) continue;
      const look = v.def.look;
      const edge = v.type === 'hoser' || v.type === 'boomer';
      // the pup this Bad Owner is keeping
      if (v.type === 'chainer') {
        ctx.fillStyle = '#6b4a2b';
        ctx.strokeStyle = A.OUT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(v.stakeX, v.y, 7, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (v.alive) this.at(v.stakeX + v.dir * 30, v.y - 8, 0, () => A.drawPup(ctx, v.id, { size: 0.75, wag: Math.sin(t * 3) * 0.15 }));
      } else if (!v.boss) {
        const cx = edge ? v.x0 - v.dir * 58 : v.type === 'snatcher' ? -20 : v.x0 + 66;
        this.at(cx, v.y0 + (edge ? 4 : 12), 0, () => A.drawCage(ctx, !v.alive, t + v.id, v.id), 1.45);
      } else {
        for (let i = 0; i < 3; i++) this.at(90 + i * 150, T.gate.y - 52, 0, () => A.drawCage(ctx, !v.alive, t + i, i + 1), 1.6);
      }
      if (!v.alive) {
        if (v.eatT < 0.32) {
          const eater = race.dogs[v.eatenBy];
          const k = v.eatT / 0.32;
          const x = eater ? v.x + (eater.x - v.x) * k : v.x, y = eater ? v.y + (eater.y - v.y) * k : v.y;
          this.at(x, y, k * 5, () => A.drawVillain(ctx, look, { t, boss: v.boss, flinch: 1 }), 1.9 * (1 - k * 0.85));
        }
        continue;
      }
      if (v.boss && v.invuln > 0 && Math.floor(t * 14) % 2) ctx.globalAlpha = 0.45;
      const o = { t: t + v.id, state: v.state, flinch: v.flinch > 0 ? 1 : 0, charge: v.charge || 0, throwing: v.throwT > 0, boss: v.boss };
      const flip = (v.type === 'hoser' || v.type === 'boomer') && v.dir < 0;
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.scale(flip ? -1.9 : 1.9, -1.9);
      A.drawVillain(ctx, look, o);
      ctx.restore();
      ctx.globalAlpha = 1;
      // the Snatcher's net
      const P = v.def;
      if (P.netR) {
        const hx = v.x + (v.boss ? 40 : 28), hy = v.y + 2;
        let nx = v.x + (v.boss ? 66 : 48), ny = v.y - 6, nr = v.boss ? 30 : 22;
        if (v.state === 'recover' || v.swing > 0) {
          nx = v.netX != null ? v.netX : nx;
          ny = v.netY != null ? v.netY : ny;
          nr = P.netR;
        } else if (v.state === 'windup') {
          ny = v.y + 50;
          nr = v.boss ? 36 : 28;
        }
        ctx.strokeStyle = '#7a5630';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(nx, ny, nr, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
        ctx.strokeStyle = '#f1f3f5';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let q = -nr; q <= nr; q += 9) {
          ctx.moveTo(nx + q, ny - nr);
          ctx.lineTo(nx + q, ny + nr);
          ctx.moveTo(nx - nr, ny + q);
          ctx.lineTo(nx + nr, ny + q);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (v.boss) {
        for (let i = 0; i < v.maxHp; i++) {
          this.at(v.x + (i - (v.maxHp - 1) / 2) * 24, v.y + 92, 0, () => {
            A.heart(ctx, 0, 0, 9);
            ctx.fillStyle = i < v.hp ? '#ff4d6d' : 'rgba(40,30,50,0.55)';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.4;
            ctx.stroke();
          });
        }
      }
    }
  }

  pups(ctx, race, y0, y1) {
    for (const d of race.dogs) {
      const n = Math.min(d.pups, 8);
      const tr = d.trail;
      for (let i = 0; i < n; i++) {
        const idx = tr.length - 2 * (8 + i * 6);
        if (idx < 2) break;
        const x = tr[idx], y = tr[idx + 1];
        if (y < y0 || y > y1) continue;
        const nx = idx + 3 < tr.length ? tr[idx + 2] : d.x, ny = idx + 3 < tr.length ? tr[idx + 3] : d.y;
        const ang = Math.atan2(nx - x, ny - y + 0.01);
        const moving = Math.hypot(d.vx, d.vy) > 20;
        this.at(x, y, moving ? ang : 0, () => A.drawPup(ctx, d.slot * 3 + i, { size: 0.75, run: this.t * (moving ? 22 : 0) + i, speed: moving ? 0.8 : 0 }));
      }
    }
  }

  dogs(ctx, race, me, dt) {
    const t = this.t;
    const order = race.dogs.slice().sort((a, b) => b.y - a.y);
    for (const d of order) {
      if (d.left) continue;
      if (d.y < this.y0 || d.y > this.y1) continue;
      const sp = Math.min(1, Math.hypot(d.vx, d.vy) / d.top);
      const col = this.colors[d.slot];
      const local = d === me;
      // ring on the ground so you can tell the dogs apart
      ctx.beginPath();
      ctx.ellipse(d.x, d.y - 2, d.r + 16, d.r + 20, 0, 0, TAU);
      ctx.strokeStyle = col;
      ctx.globalAlpha = local ? 0.95 : 0.6;
      ctx.lineWidth = local ? 4.5 : 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (d.inWater && sp > 0.1 && Math.random() < 0.5) {
        this.p({ x: d.x + (Math.random() - 0.5) * 30, y: d.y - 20, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, color: '#d6f0ff', size: 4, life: 0.4 });
      }
      if (d.inWater) {
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r + 12 + Math.sin(t * 9) * 3, d.r + 24 + Math.sin(t * 9) * 3, 0, 0, TAU);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      if (d.zoom > 0) {
        for (let i = 0; i < 2; i++) {
          this.p({ kind: 'streak', x: d.x + (Math.random() - 0.5) * 36, y: d.y - 40, vx: -d.vx * 0.2, vy: -d.vy * 0.25, color: ['#ffd23f', '#ff9f1c', '#fff'][Math.floor(Math.random() * 3)], size: 5, life: 0.3 });
        }
      }
      if (d.happy > 0 && Math.random() < 0.12) this.p({ kind: 'heart', x: d.x + (Math.random() - 0.5) * 24, y: d.y - 24, vy: 40, color: '#ff8fab', size: 5, life: 0.7 });
      if (d.soak > 0 && Math.random() < 0.3) this.p({ x: d.x + (Math.random() - 0.5) * 30, y: d.y + (Math.random() - 0.5) * 30, vy: -60, color: '#9bd3ff', size: 3.5, life: 0.4 });
      const jit = d.cower > 0 ? Math.sin(t * 60) * 2 : 0;
      const mood = d.stun > 0 || d.net > 0 ? 'dizzy' : d.hug || d.hugging || d.happy > 0 ? 'happy' : null;
      const size = 1.5 * d.def.size * (d.zoom > 0 ? 1.06 : 1) * (d.cower > 0 ? 0.92 : 1);
      this.at(d.x + jit, d.y, d.ang, () => A.drawDogTop(ctx, d.def.look, {
        size, run: d.run, speed: sp, collar: col, t, belly: Math.min(1, d.belly / 0.4), tongue: sp > 0.7 || d.zoom > 0, mood
      }));
      if (d.net > 0) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r + 28, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = '#f1f3f5';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let q = -66; q <= 66; q += 11) {
          ctx.moveTo(d.x + q, d.y - 66);
          ctx.lineTo(d.x + q, d.y + 66);
          ctx.moveTo(d.x - 66, d.y + q);
          ctx.lineTo(d.x + 66, d.y + q);
        }
        ctx.stroke();
        ctx.restore();
        if (local) this.label(d.x, d.y + 84, 'WIGGLE!', '#fff', 20, 0.6 + Math.sin(t * 14) * 0.4);
      }
      if (d.stun > 0) {
        for (let i = 0; i < 3; i++) {
          const a = t * 8 + (i / 3) * TAU;
          this.at(d.x + Math.cos(a) * 28, d.y + 50 + Math.sin(a) * 9, 0, () => {
            A.star(ctx, 0, 0, 7);
            ctx.fillStyle = '#ffd23f';
            ctx.fill();
          });
        }
      }
      if (local && race.phase === 'count') this.label(d.x, d.y + 96, 'YOU', col, 20, 1, '#fff');
      else if (!local && race.phase === 'count') this.label(d.x, d.y + 92, d.control === 'remote' ? 'P' + (d.slot + 1) : d.def.name.split(' ')[0], '#fff', 13, 0.9);
    }
  }

  cat(ctx, race) {
    const c = race.cat, T = race.track;
    if (c.state === 'tree') return;
    const sit = c.state !== 'run' || c.speed < 20;
    if ((c.state === 'taunt' || c.state === 'windup')) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 46 + Math.sin(this.t * 6) * 4, 0, TAU);
      ctx.strokeStyle = 'rgba(155,231,255,0.95)';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = this.t * 40;
      ctx.stroke();
      ctx.setLineDash([]);
      this.label(c.x, c.y + 76, 'TAG ME!', '#9be7ff', 18, 0.7 + Math.sin(this.t * 8) * 0.3);
    }
    void T;
    this.at(c.x, c.y, 0, () => A.drawCatTop(ctx, { state: sit ? 'sit' : 'run', run: c.y * 0.07, t: this.t }), 2);
  }

  finishTree(ctx, race, T) {
    const tr = T.tree;
    if (tr.y < this.y0 - 200 || tr.y > this.y1 + 200) return;
    this.at(tr.x, tr.y, 0, () => {
      ctx.beginPath();
      ctx.ellipse(8, 12, 96, 90, 0, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 92, 88, 0, 0, TAU);
      ctx.fillStyle = '#2f9e44';
      ctx.fill();
      ctx.strokeStyle = A.OUT;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#40c057';
      for (const [x, y, r] of [[-30, -28, 40], [34, -10, 30], [-10, 34, 30]]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    });
    if (race.cat.state === 'tree') {
      this.at(tr.x, tr.y, 0, () => A.drawCatTop(ctx, { state: 'sit', t: this.t }), 2.2);
    }
  }

  particles(ctx, dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) {
        ps.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const dr = Math.pow(p.drag, dt * 60);
      p.vx *= dr;
      p.vy *= dr;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      switch (p.kind) {
        case 'text':
          this.label(p.x, p.y, p.str, p.color, p.size * (k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1), Math.max(0, 1 - k * k));
          break;
        case 'heart':
          this.at(p.x, p.y, 0, () => {
            A.heart(ctx, 0, 0, p.size * (0.6 + k * 0.6));
            ctx.fillStyle = p.color;
            ctx.fill();
          });
          break;
        case 'star':
          this.at(p.x, p.y, p.age * 8, () => {
            A.star(ctx, 0, 0, p.size * (1 - k * 0.5));
            ctx.fillStyle = p.color;
            ctx.fill();
          });
          break;
        case 'ring':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + p.grow * k, 0, TAU);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.lw || 3;
          ctx.stroke();
          break;
        case 'puff':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + p.grow * k, 0, TAU);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        case 'streak':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (1 - k);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y - 34);
          ctx.stroke();
          break;
        case 'confetti':
          this.at(p.x, p.y, p.age * 9 + p.size, () => {
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          });
          break;
        default:
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, TAU);
          ctx.fillStyle = p.color;
          ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  decor(ctx, T, th, y0, y1, lamps) {
    for (const d of T.decor) {
      if (d.y < y0 - 80 || d.y > y1 + 80) continue;
      if ((d.kind === 'lamp') !== lamps) continue;
      const big = d.kind === 'house' || d.kind === 'building';
      const x = d.side < 0 ? (big ? -72 : -26) : T.W + (big ? 72 : 26);
      this.at(x, d.y, 0, () => A.drawDecor(ctx, d.kind, d.side, d.v, th.night), d.s);
    }
  }

  countdown(ctx, race) {
    let str = null, k = 0;
    if (race.phase === 'count') {
      const n = Math.ceil(race.count);
      if (n <= 3 && n >= 1) {
        str = String(n);
        k = 1 - (race.count - (n - 1));
      } else {
        str = 'READY';
        k = 0.5;
      }
    } else if (this.goT >= 0 && this.goT < 0.9) {
      str = 'CHASE!';
      k = this.goT / 0.9;
    }
    if (!str) return;
    const size = (str.length > 1 ? this.w * 0.165 : this.w * 0.36) * (1.2 - k * 0.2);
    ctx.save();
    ctx.globalAlpha = Math.min(1, 1.6 - k * 1.2);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = 'rgba(20,12,30,0.9)';
    ctx.strokeText(str, this.w / 2, this.h * 0.4);
    ctx.fillStyle = str === 'CHASE!' ? '#ffd23f' : '#fff';
    ctx.fillText(str, this.w / 2, this.h * 0.4);
    ctx.restore();
  }
}
