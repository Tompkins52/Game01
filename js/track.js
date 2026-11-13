// Builds a race course from a level's token string (see data/levels.json).
// Pure logic: no DOM, so the same code runs in the browser and in the Node tests.

export function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How much track each token uses, in world units.
export const TOKEN_LEN = {
  o: 600, b: 700, p: 700, P: 900, s: 700, h: 600, c: 700, k: 500, t: 600,
  H: 900, N: 900, C: 800, Y: 900, F: 900, X: 1700
};

export const VILLAIN_TOKENS = { H: 'hoser', N: 'snatcher', C: 'chainer', Y: 'yeller', F: 'boomer' };

const lerp = (a, b, t) => a + (b - a) * t;
// A pair [a, b] in the data means "a on the first level, b on the last".
export const blend = (v, d) => (Array.isArray(v) ? lerp(v[0], v[1], d) : v);

const SKIN = ['#f6d3b3', '#e9b98f', '#c98d62', '#8d5b3c', '#5c3a24'];
const HAIR = ['#2b1d14', '#5a3b22', '#b5762e', '#e6c35c', '#c0392b', '#141414'];
const SHIRT = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ffa94d', '#38d9a9'];

export function buildTrack(level, world, rules, vdefs, levelCount = 20) {
  const W = rules.track.width;
  const R = rng32(level.seed);
  const diff = (level.id - 1) / Math.max(1, levelCount - 1);
  const T = {
    W, margin: rules.track.margin, level, world, diff,
    waters: [], bridges: [], solids: [], knocks: [], bones: [], kids: [],
    villains: [], taunts: [], decor: [], boss: null, gate: null, villainCount: 0
  };
  let ids = 0;
  const nid = () => ++ids;
  const rr = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[Math.floor(R() * arr.length) % arr.length];

  const bone = (x, y) => T.bones.push({ id: nid(), x: Math.max(22, Math.min(W - 22, x)), y, taken: false });
  const puddle = (x, y, rx, ry) => T.waters.push({ id: nid(), shape: 'e', x, y, rx, ry, y0: y - ry, y1: y + ry });
  const band = (y0, y1) => T.waters.push({ id: nid(), shape: 'r', x0: -60, x1: W + 60, y0, y1 });
  const solid = (kind, x, y, hw, hh, extra) => {
    const s = Object.assign({ id: nid(), kind, x, y, hw, hh, active: true }, extra || {});
    T.solids.push(s);
    return s;
  };
  const knock = (kind, x, y) => T.knocks.push({ id: nid(), kind, x, y, r: 24, hit: false, vx: 0, vy: 0, t: 0, spin: 0 });
  const kid = (x, y) => T.kids.push({
    id: nid(), x, y, hugged: {}, wave: R() * 6,
    look: { skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT), style: Math.floor(R() * 4) }
  });
  const villain = (type, x, y, extra) => {
    const def = vdefs.types[type];
    const v = Object.assign({
      id: nid(), type, def, x, y, x0: x, y0: y, r: def.r, alive: true, state: 'idle',
      t: R() * 2, flinch: 0, eatT: 0, eatenBy: -1, boss: false, face: 0
    }, extra || {});
    T.villains.push(v);
    T.villainCount++;
    return v;
  };

  const gen = {
    o(y0) {
      const x = pick([96, 192, 288, 384]);
      const ph = R() * 6;
      for (let i = 0; i < 5; i++) bone(x + Math.sin(i * 0.9 + ph) * 26, y0 + 110 + i * 92);
      if (R() < 0.4) puddle(x < 240 ? rr(300, 410) : rr(70, 180), y0 + rr(200, 420), rr(48, 66), rr(36, 52));
    },
    b(y0) {
      const ph = R() * 6;
      const amp = rr(110, 160);
      for (let i = 0; i < 9; i++) bone(W / 2 + Math.sin(i * 0.72 + ph) * amp, y0 + 70 + i * 70);
    },
    p(y0) {
      const ys = [150, 350, 550];
      let last = -999;
      for (const dy of ys) {
        let x = rr(80, 400);
        if (Math.abs(x - last) < 110) x = x < 240 ? x + 170 : x - 170;
        last = x;
        puddle(x, y0 + dy, rr(56, 92), rr(42, 66));
        bone(W - x + rr(-20, 20), y0 + dy);
      }
    },
    P(y0) {
      const left = R() < 0.5;
      const cx = left ? 150 : W - 150;
      puddle(cx, y0 + 450, 168, 300);
      const dry = left ? W - 64 : 64;
      for (let i = 0; i < 4; i++) bone(dry + rr(-12, 12), y0 + 200 + i * 150);
      bone(cx, y0 + 380);
      bone(cx, y0 + 520);
    },
    s(y0) {
      const h = world.id === 4 ? rr(170, 200) : rr(140, 185);
      const a = y0 + 300, b = a + h;
      band(a, b);
      const spots = [84, 170, 240, 310, 396];
      const n = diff < 0.35 ? 2 : 1;
      const first = Math.floor(R() * spots.length);
      const chosen = [spots[first]];
      if (n === 2) chosen.push(spots[(first + 2 + Math.floor(R() * 2)) % spots.length]);
      for (const c of chosen) {
        T.bridges.push({ id: nid(), x0: c - 72, x1: c + 72, y0: a - 14, y1: b + 14 });
        bone(c, y0 + 150);
        bone(c, (a + b) / 2);
        bone(c, b + 90);
      }
    },
    h(y0) {
      const y = y0 + 320;
      const gapW = lerp(152, 124, diff);
      const two = diff < 0.5 || R() < 0.45;
      const centers = [];
      const c1 = rr(90, two ? 180 : W - 90);
      centers.push(c1);
      if (two) centers.push(Math.min(W - 86, c1 + rr(200, 250)));
      centers.sort((p, q) => p - q);
      let x = 0;
      for (const c of centers) {
        const l = c - gapW / 2;
        if (l - x > 8) solid('hedge', (x + l) / 2, y, (l - x) / 2, 22);
        x = c + gapW / 2;
        bone(c, y);
        bone(c, y - 130);
      }
      if (W - x > 8) solid('hedge', (x + W) / 2, y, (W - x) / 2, 22);
    },
    c(y0) {
      const kinds = world.theme.clutter;
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const y = y0 + 110 + r * 120 + rr(-20, 20);
        const n = R() < 0.35 + diff * 0.35 ? 2 : 1;
        let px = rr(50, 430);
        for (let i = 0; i < n; i++) {
          const k = pick(kinds);
          if (k === 'crate') solid('crate', px, y, 30, 30);
          else knock(k, px, y);
          px = px < 240 ? px + rr(150, 220) : px - rr(150, 220);
        }
        if (r % 2 === 0) bone(rr(40, 440), y + 60);
      }
    },
    k(y0) {
      const x = rr(80, 400);
      kid(x, y0 + 250);
      if (R() < 0.4) kid(x < W / 2 ? rr(W / 2 + 50, W - 60) : rr(60, W / 2 - 50), y0 + 380);
      bone(W / 2 + rr(-60, 60), y0 + 110);
      bone(W / 2 + rr(-60, 60), y0 + 430);
    },
    t(y0) {
      const x = W / 2 + rr(-110, 110);
      T.taunts.push({ id: nid(), x, y: y0 + 340, done: false });
      for (let i = 0; i < 4; i++) bone(x + rr(-14, 14), y0 + 40 + i * 62);
    },
    H(y0) {
      const left = R() < 0.5;
      const x = left ? 40 : W - 40;
      const dir = left ? 1 : -1;
      const y = y0 + 480;
      villain('hoser', x, y, { dir, phase: R() * 6, jet: null });
      puddle(x + dir * 130, y - 120, 52, 36);
      puddle(x + dir * 210, y + 120, 60, 40);
      bone(x + dir * 6, y - 250);
      bone(x + dir * 6, y - 160);
      for (let i = 0; i < 3; i++) bone(W - x - dir * 20, y - 150 + i * 150);
    },
    N(y0) {
      const y = y0 + 520;
      villain('snatcher', W / 2 + rr(-120, 120), y, { dir: R() < 0.5 ? 1 : -1, state: 'patrol', swing: 0 });
      for (let i = 0; i < 3; i++) bone(120 + i * 120, y - 300);
      bone(W / 2, y + 150);
    },
    C(y0) {
      const left = R() < 0.5;
      const x = left ? 64 : W - 64;
      const dir = left ? 1 : -1;
      const y = y0 + 420;
      const span = blend(vdefs.types.chainer.span, diff) * W;
      const sx = x + dir * span;
      const chain = solid('chain', (x + sx) / 2 + dir * 14, y, span / 2 - 14, 8, { ax: x, bx: sx });
      villain('chainer', x, y, { dir, chainId: chain.id, stakeX: sx });
      const gapX = left ? (sx + W) / 2 : sx / 2;
      bone(gapX, y);
      bone(gapX, y - 110);
      bone(x + dir * 4, y - 200);
      bone(x + dir * 4, y - 120);
    },
    Y(y0) {
      const x = rr(140, W - 140);
      const y = y0 + 500;
      villain('yeller', x, y, { next: rr(0.6, 1.6) });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.6;
        bone(x + Math.cos(a) * 112, y + Math.sin(a) * 112);
      }
    },
    F(y0) {
      const left = R() < 0.5;
      const x = left ? 46 : W - 46;
      const y = y0 + 470;
      villain('boomer', x, y, { dir: left ? 1 : -1, next: rr(0.5, 1.5) });
      for (let i = 0; i < 3; i++) bone(W / 2 + rr(-70, 70), y - 180 + i * 180);
    },
    X(y0) {
      const def = vdefs.bosses[level.boss];
      const bx = W / 2, by = y0 + 840;
      const v = {
        id: nid(), type: 'boss', kind: level.boss, def, x: bx, y: by, x0: bx, y0: by, r: def.r,
        alive: true, state: 'idle', t: 0, flinch: 0, eatT: 0, eatenBy: -1, boss: true,
        hp: def.hp, maxHp: def.hp, invuln: 0, phase: 0, next: 1.2, dir: 1, swing: 0, face: 0,
        arena: { y0: y0 + 420, y1: y0 + 1380 }
      };
      T.villains.push(v);
      T.villainCount++;
      T.boss = v;
      T.gate = solid('gate', W / 2, y0 + 1560, W / 2 + 60, 18);
      T.arenaY = y0 + 150;
      for (let i = 0; i < 6; i++) bone(rr(50, W - 50), y0 + rr(200, 1400));
    }
  };

  let y = rules.track.runway;
  const tokens = level.tokens.trim().split(/\s+/);
  T.segments = [];
  for (const tk of tokens) {
    const len = TOKEN_LEN[tk];
    if (!len) throw new Error('Unknown track token: ' + tk);
    gen[tk](y, len);
    T.segments.push({ token: tk, y0: y, y1: y + len });
    y += len;
  }
  T.finishY = y;
  T.length = y + rules.track.runout;
  T.tree = { x: W / 2, y: y + 260 };

  // Scenery along both edges. Drawn only; nothing collides with it.
  const kinds = world.theme.decor;
  for (let dy = -300; dy < T.length + 400; dy += rr(120, 200)) {
    T.decor.push({ kind: pick(kinds), side: -1, y: dy, s: rr(0.85, 1.2), v: Math.floor(R() * 4) });
    T.decor.push({ kind: pick(kinds), side: 1, y: dy + rr(30, 90), s: rr(0.85, 1.2), v: Math.floor(R() * 4) });
  }

  for (const list of [T.bones, T.kids, T.knocks, T.villains, T.solids, T.waters]) {
    list.sort((p, q) => (p.y ?? p.y0) - (q.y ?? q.y0));
  }
  return T;
}

// True when the point is in water and not on a bridge.
export function inWater(T, x, y) {
  let wet = false;
  for (const w of T.waters) {
    if (y < w.y0 || y > w.y1) continue;
    if (w.shape === 'r') { wet = true; break; }
    const dx = (x - w.x) / w.rx, dy = (y - w.y) / w.ry;
    if (dx * dx + dy * dy < 1) { wet = true; break; }
  }
  if (!wet) return false;
  for (const b of T.bridges) {
    if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return false;
  }
  return true;
}

// True when a circle at (x, y) would overlap an active solid.
export function blocked(T, x, y, pad) {
  for (const s of T.solids) {
    if (!s.active) continue;
    if (Math.abs(y - s.y) > s.hh + pad || Math.abs(x - s.x) > s.hw + pad) continue;
    return s;
  }
  return null;
}
