// The race itself: dogs, water, kids, Bad Owners, the cat, rival dogs and scoring.
// Pure logic with no DOM, so the Node tests can play every level without a browser.
// The screen layer reads state from a Race and drains race.events for sound and effects.

import { inWater, blocked, blend, rng32 } from './track.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const byId = (list, id) => list.find((o) => o.id === id);

export const DT = 1 / 60;
export const START_X = [84, 188, 292, 396];

function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const L2 = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / L2, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

// Total Love needed to reach a dog level, and the level a Love total gives.
export function loveForLevel(level, rules) {
  const L = rules.love;
  let total = 0;
  for (let n = 1; n < level; n++) total += L.needBase + L.needStep * (n - 1);
  return total;
}
export function levelForLove(love, rules) {
  let lvl = 1;
  while (lvl < rules.love.maxLevel && love >= loveForLevel(lvl + 1, rules)) lvl++;
  return lvl;
}
export function rankTitle(level, rules) {
  let title = rules.love.ranks[0].title;
  for (const r of rules.love.ranks) if (level >= r.level) title = r.title;
  return title;
}

export class Race {
  // opts: { track, rules, dogDefs: {id: def}, racers: [{slot, dogId, control, dogLevel, name}],
  //         npc: {skill, aggression}, seed }
  constructor(opts) {
    this.track = opts.track;
    this.rules = opts.rules;
    this.W = this.track.W;
    this.diff = this.track.diff;
    this.t = 0;
    this.count = 3.4;
    this.phase = 'count';
    this.events = [];
    this.rings = [];
    this.bombs = [];
    this.placed = 0;
    this.firstFinishT = -1;
    this.mult = 1 + this.rules.points.perLevelBonus * (this.track.level.id - 1);
    this.rnd = rng32((opts.seed || 1) * 31 + 7);
    this.npc = opts.npc || { skill: 0.6, aggression: 0.5 };
    this.dogs = opts.racers.map((r) => this.makeDog(r, opts.dogDefs[r.dogId]));
    this.cat = { x: this.W / 2, y: 330, state: 'sit', t: 0, st: 0, taunt: null, speed: 0 };
    this.maxSeconds = 300;
  }

  makeDog(r, def) {
    const R = this.rules;
    const lvl = r.dogLevel || 1;
    const rad = 30 * def.size;
    return {
      slot: r.slot, id: def.id, def, name: r.name || def.name, control: r.control, level: lvl,
      x: START_X[r.slot], y: 80, vx: 0, vy: 0, ang: 0, r: rad, hr: rad * (def.hazardScale || 1),
      top: def.speed * (1 + R.love.speedPerLevel * (lvl - 1)),
      scoreMult: 1 + R.points.perDogLevelBonus * (lvl - 1),
      input: { x: 0, y: 0, zoom: false }, wig: 0,
      energy: def.startPips != null ? def.startPips : R.energy.startPips,
      stun: 0, net: 0, soak: 0, cower: 0, happy: 0, zoom: 0, ifr: 0, bonk: 0, belly: 0,
      hug: null, inWater: false, run: 0, bark: 0,
      score: 0, pts: {}, love: 0, chomps: 0, hugs: 0, bones: 0, tags: 0, hits: 0, combo: 0, pups: 0,
      finished: false, dnf: false, time: 0, place: 0, trail: [], trailT: 0,
      tx: START_X[r.slot], ty: 80, left: false,
      ai: {
        skill: clamp(this.npc.skill + (this.rnd() - 0.5) * 0.16, 0.2, 1),
        aggr: clamp(this.npc.aggression + (this.rnd() - 0.5) * 0.3, 0.1, 1),
        hugs: this.rnd() < 0.55, lane: START_X[r.slot], plan: 0, stuckT: 0, stuckY: 80, back: 0, side: 1,
        zoomCd: 1.5, orbit: this.rnd() < 0.5 ? 1 : -1, wander: 0
      }
    };
  }

  emit(type, data) {
    this.events.push(Object.assign({ type }, data));
  }

  award(d, base, cat) {
    const pts = Math.round((base * this.mult * d.scoreMult) / 10) * 10;
    d.score += pts;
    d.pts[cat] = (d.pts[cat] || 0) + pts;
    return pts;
  }

  setInput(slot, x, y, zoom) {
    const d = this.dogs[slot];
    if (!d) return;
    d.input.x = clamp(x, -1, 1);
    d.input.y = clamp(y, -1, 1);
    if (zoom) d.input.zoom = true;
  }

  // ---------------------------------------------------------------- main step
  step(dt = DT) {
    if (this.phase === 'over') return;
    if (this.phase === 'count') {
      const before = Math.ceil(this.count);
      this.count -= dt;
      const after = Math.ceil(this.count);
      if (after !== before && after > 0 && after <= 3) this.emit('count', { n: after });
      this.cat.t += dt;
      if (this.count <= 0) {
        this.phase = 'run';
        this.cat.state = 'run';
        this.emit('go', {});
      }
      return;
    }
    this.t += dt;
    for (const d of this.dogs) {
      if (d.control === 'ai' && !d.finished) this.aiInput(d, dt);
      this.updateDog(d, dt);
    }
    this.separate();
    for (const d of this.dogs) {
      if (d.control !== 'remote' && !d.finished) this.interact(d);
    }
    for (const v of this.track.villains) this.updateVillain(v, dt);
    this.updateRings(dt);
    this.updateBombs(dt);
    for (const k of this.track.knocks) {
      if (!k.hit) continue;
      k.t += dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.vx *= 0.96;
      k.vy *= 0.96;
    }
    this.updateCat(dt);
    for (const d of this.dogs) {
      if (!d.finished && d.control !== 'remote' && d.y >= this.track.finishY) this.finish(d, this.t);
    }
    if (this.firstFinishT >= 0 && this.t - this.firstFinishT > this.rules.finishCountdown) this.forceEnd('timeup');
    if (this.t > this.maxSeconds) this.forceEnd('timeup');
    if (this.dogs.every((d) => d.finished)) this.phase = 'over';
  }

  finish(d, time) {
    if (d.finished) return;
    d.finished = true;
    d.time = time;
    d.place = ++this.placed;
    if (this.firstFinishT < 0) this.firstFinishT = this.t;
    this.emit('finish', { slot: d.slot, place: d.place, time, net: d.control !== 'remote' });
  }

  // Place everyone who has not finished by how far they got.
  forceEnd(why) {
    const rest = this.dogs.filter((d) => !d.finished).sort((a, b) => b.y - a.y);
    for (const d of rest) {
      d.finished = true;
      d.dnf = true;
      d.time = this.t;
      d.place = ++this.placed;
    }
    if (rest.length) this.emit(why || 'timeup', {});
    this.phase = 'over';
  }

  secondsLeft() {
    if (this.firstFinishT < 0) return null;
    return Math.max(0, this.rules.finishCountdown - (this.t - this.firstFinishT));
  }

  // ---------------------------------------------------------------- dogs
  updateDog(d, dt) {
    const R = this.rules, T = this.track;
    for (const k of ['soak', 'cower', 'happy', 'zoom', 'ifr', 'bonk', 'belly', 'bark']) if (d[k] > 0) d[k] = Math.max(0, d[k] - dt);
    d.trailT -= dt;
    if (d.trailT <= 0) {
      d.trailT = 0.05;
      d.trail.push(d.x, d.y);
      if (d.trail.length > 160) d.trail.splice(0, 2);
    }
    if (d.control === 'remote') {
      const k = Math.min(1, 12 * dt);
      const ox = d.x, oy = d.y;
      d.x += (d.tx - d.x) * k;
      d.y += (d.ty - d.y) * k;
      const sp = Math.hypot(d.x - ox, d.y - oy) / dt;
      if (sp > 25) d.ang = turnTo(d.ang, Math.atan2(d.x - ox, d.y - oy), Math.min(1, 10 * dt));
      d.run += sp * dt * 0.045;
      return;
    }
    if (d.finished) {
      // Trot over to the tree and bark at the cat.
      const tx = T.tree.x + (d.slot - 1.5) * 88, ty = T.tree.y - 130;
      const dx = tx - d.x, dy = ty - d.y, L = Math.hypot(dx, dy);
      if (L > 6) {
        const sp = Math.min(330, L * 4);
        d.vx = (dx / L) * sp;
        d.vy = (dy / L) * sp;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.ang = turnTo(d.ang, Math.atan2(dx, dy), Math.min(1, 8 * dt));
        d.run += sp * dt * 0.045;
      } else {
        d.vx = d.vy = 0;
        d.ang = turnTo(d.ang, 0, Math.min(1, 6 * dt));
      }
      return;
    }
    const inp = d.input;
    const wantZoom = inp.zoom;
    inp.zoom = false;

    if (d.net > 0) {
      // Wiggle to break out faster.
      const sgn = inp.x > 0.4 ? 1 : inp.x < -0.4 ? -1 : 0;
      if (sgn !== 0 && sgn !== d.wig) {
        if (d.wig !== 0) d.net -= 0.16;
        d.wig = sgn;
      }
      d.net -= dt;
      d.vx = d.vy = 0;
      if (d.net <= 0) {
        d.net = 0;
        this.emit('free', { slot: d.slot, x: d.x, y: d.y });
      }
      return;
    }
    if (d.stun > 0) {
      d.stun -= dt;
      d.vx *= 0.9;
      d.vy *= 0.9;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      this.bounds(d);
      this.collide(d);
      return;
    }
    if (d.hug) {
      const h = d.hug, kd = h.kid;
      const tx = kd.x, ty = kd.y - 60;
      const k = Math.min(1, 9 * dt);
      const ox = d.x, oy = d.y;
      d.x += (tx - d.x) * k;
      d.y += (ty - d.y) * k;
      d.vx = d.vy = 0;
      d.run += Math.hypot(d.x - ox, d.y - oy) * 0.045;
      d.ang = turnTo(d.ang, Math.atan2(kd.x - d.x, kd.y - d.y), Math.min(1, 8 * dt));
      h.t += dt;
      if (h.t >= h.dur) {
        d.hug = null;
        kd.hugged[d.slot] = true;
        d.hugs++;
        const pts = this.award(d, R.points.hug, 'hug');
        const love = Math.round(R.love.hug * d.def.heart);
        d.love += love;
        d.energy = Math.min(R.energy.maxPips, d.energy + R.energy.hug);
        d.happy = R.move.happySeconds;
        d.ifr = Math.max(d.ifr, 0.6);
        this.emit('hug', { id: kd.id, slot: d.slot, x: kd.x, y: kd.y, pts, love, net: true });
      }
      return;
    }

    if (wantZoom && d.zoom <= 0 && d.energy >= 1) this.startZoom(d);

    const zooming = d.zoom > 0;
    d.inWaterPrev = d.inWater;
    d.inWater = inWater(T, d.x, d.y);
    if (d.inWater && !d.inWaterPrev) this.emit('splash', { slot: d.slot, x: d.x, y: d.y });
    let mult = 1;
    if (zooming) mult *= R.energy.zoomBoost;
    else {
      if (d.inWater) mult *= d.def.swim;
      if (d.soak > 0) mult *= R.move.soakFactor;
      if (d.cower > 0) mult *= R.move.cowerFactor;
      if (d.bonk > 0) mult *= 0.6;
    }
    if (d.happy > 0) mult *= R.move.happyBoost;
    const top = d.top * (d.speedFactor || 1) * mult;
    let ix = inp.x, iy = inp.y;
    const m = Math.hypot(ix, iy);
    if (m > 1) {
      ix /= m;
      iy /= m;
    }
    const tvx = ix * top * R.move.sideFactor;
    const tvy = (iy >= 0 ? iy : iy * R.move.backFactor) * top;
    const k = Math.min(1, d.def.accel * dt);
    d.vx += (tvx - d.vx) * k;
    d.vy += (tvy - d.vy) * k;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const sp = Math.hypot(d.vx, d.vy);
    if (sp > 30) d.ang = turnTo(d.ang, Math.atan2(d.vx, Math.max(d.vy, sp * 0.2)), Math.min(1, 10 * dt));
    d.run += sp * dt * 0.045;
    this.bounds(d);
    this.collide(d);
  }

  startZoom(d) {
    const E = this.rules.energy;
    d.energy -= 1;
    d.zoom = E.zoomSeconds * (d.def.zoomTime || 1);
    d.soak = d.cower = d.bonk = 0;
    d.bark = 0.45;
    const stun = E.barkStun * (d.def.barkStun || 1);
    for (const v of this.track.villains) {
      if (!v.alive) continue;
      if (dist(v.x, v.y, d.x, d.y) < E.barkRadius) v.flinch = Math.max(v.flinch, v.boss ? stun * 0.5 : stun);
    }
    this.emit('zoom', { slot: d.slot, x: d.x, y: d.y, net: true });
  }

  bounds(d) {
    if (d.x < d.r) {
      d.x = d.r;
      if (d.vx < 0) d.vx = 0;
    }
    if (d.x > this.W - d.r) {
      d.x = this.W - d.r;
      if (d.vx > 0) d.vx = 0;
    }
    if (d.y < 30) {
      d.y = 30;
      if (d.vy < 0) d.vy = 0;
    }
    const top = this.track.length - 40;
    if (d.y > top) d.y = top;
  }

  collide(d) {
    for (const s of this.track.solids) {
      if (!s.active) continue;
      if (Math.abs(d.y - s.y) > s.hh + d.r || Math.abs(d.x - s.x) > s.hw + d.r) continue;
      const cx = clamp(d.x, s.x - s.hw, s.x + s.hw), cy = clamp(d.y, s.y - s.hh, s.y + s.hh);
      const dx = d.x - cx, dy = d.y - cy;
      const dd = dx * dx + dy * dy;
      if (dd >= d.r * d.r) continue;
      if (dd < 1e-6) {
        // Centre is inside the box: pop out the way we came.
        if (d.vy >= 0) d.y = s.y - s.hh - d.r;
        else d.y = s.y + s.hh + d.r;
        d.vy = 0;
        continue;
      }
      const L = Math.sqrt(dd), nx = dx / L, ny = dy / L;
      d.x = cx + nx * d.r;
      d.y = cy + ny * d.r;
      const vn = d.vx * nx + d.vy * ny;
      if (vn < 0) {
        d.vx -= vn * nx;
        d.vy -= vn * ny;
        if (vn < -240 && d.bonk <= 0) {
          d.bonk = 0.3;
          this.emit('bonk', { slot: d.slot, x: d.x, y: d.y });
        }
      }
    }
  }

  separate() {
    const ds = this.dogs;
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const a = ds[i], b = ds[j];
        if (a.finished || b.finished || a.hug || b.hug || a.left || b.left) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r - 10;
        const dd = dx * dx + dy * dy;
        if (dd >= min * min || dd < 1e-6) continue;
        const L = Math.sqrt(dd), push = (min - L) / 2, nx = dx / L, ny = dy / L;
        if (a.control !== 'remote') {
          a.x -= nx * push;
          a.y -= ny * push;
        }
        if (b.control !== 'remote') {
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  // Bones, kids, knock-overs and Bad Owners for one dog.
  interact(d) {
    const R = this.rules, T = this.track;
    if (d.net > 0 || d.stun > 0 || d.hug) return;
    for (const b of T.bones) {
      if (b.taken) continue;
      if (b.y - d.y > 60) break;
      if (d.y - b.y > 60) continue;
      if (dist(b.x, b.y, d.x, d.y) < d.r + 20) {
        b.taken = true;
        d.bones++;
        const pts = this.award(d, R.points.bone, 'bone');
        d.energy = Math.min(R.energy.maxPips, d.energy + R.energy.bone);
        this.emit('bone', { id: b.id, slot: d.slot, x: b.x, y: b.y, pts, net: true });
      }
    }
    for (const k of T.knocks) {
      if (k.hit) continue;
      if (dist(k.x, k.y, d.x, d.y) < d.r + k.r) {
        k.hit = true;
        k.vx = d.vx * 0.9 + (k.x - d.x) * 6;
        k.vy = d.vy * 0.9 + 120;
        if (d.zoom <= 0) {
          d.vx *= 0.72;
          d.vy *= 0.72;
        }
        this.emit('knock', { id: k.id, slot: d.slot, x: k.x, y: k.y, net: true });
      }
    }
    if (d.zoom <= 0) {
      for (const kd of T.kids) {
        if (kd.hugged[d.slot]) continue;
        if (dist(kd.x, kd.y, d.x, d.y) < R.move.hugRadius) {
          d.hug = { kid: kd, t: 0, dur: R.move.hugSeconds * (d.def.hugTime || 1) };
          this.emit('hugstart', { id: kd.id, slot: d.slot, x: kd.x, y: kd.y });
          return;
        }
      }
    }
    for (const v of T.villains) {
      if (!v.alive) continue;
      if (Math.abs(v.y - d.y) > 160) continue;
      if (dist(v.x, v.y, d.x, d.y) < d.r + v.r + (d.def.reach || 0)) {
        if (v.boss) this.biteBoss(v, d);
        else this.chomp(v, d);
      }
    }
  }

  chomp(v, d) {
    const R = this.rules;
    this.killVillain(v, d.slot);
    const steps = R.points.combo;
    const mult = steps[Math.min(d.combo, steps.length - 1)];
    d.combo++;
    d.chomps++;
    d.pups++;
    d.belly = 0.6;
    const pts = this.award(d, R.points.chomp * mult, 'chomp');
    d.love += R.love.chomp;
    d.energy = Math.min(R.energy.maxPips, d.energy + R.energy.chomp * (d.def.chompEnergy || 1));
    this.emit('chomp', { id: v.id, slot: d.slot, x: v.x, y: v.y, pts, combo: d.combo, kind: v.type, net: true });
  }

  killVillain(v, slot) {
    v.alive = false;
    v.eatT = 0;
    v.eatenBy = slot;
    v.jet = null;
    v.jets = null;
    if (v.chainId) {
      const s = byId(this.track.solids, v.chainId);
      if (s) s.active = false;
    }
    if (v.boss && this.track.gate) this.track.gate.active = false;
  }

  bossSpot(v, n) {
    // Same spot on every phone: it depends only on the level seed and the bite number.
    const r = rng32(this.track.level.seed * 13 + n * 101);
    return { x: 90 + r() * (this.W - 180), y: v.arena.y0 + r() * (v.arena.y1 - v.arena.y0) };
  }

  hitBoss(v, slot) {
    v.hp--;
    v.invuln = 1.6;
    v.state = 'patrol';
    v.goal = null;
    if (v.hp <= 0) {
      this.killVillain(v, slot);
      return true;
    }
    const s = this.bossSpot(v, v.hp);
    v.x = s.x;
    v.y = s.y;
    return false;
  }

  biteBoss(v, d) {
    if (v.invuln > 0) return;
    const R = this.rules;
    const bx = v.x, by = v.y;
    const dead = this.hitBoss(v, d.slot);
    d.combo++;
    d.chomps++;
    d.belly = 0.5;
    let pts = this.award(d, R.points.bossHit, 'boss');
    if (dead) {
      pts += this.award(d, R.points.bossFinalBlow, 'boss');
      d.pups += 3;
    }
    d.love += R.love.bossHit;
    d.energy = Math.min(R.energy.maxPips, d.energy + R.energy.bossHit);
    d.ifr = Math.max(d.ifr, 0.8);
    this.emit(dead ? 'bossdown' : 'bosshit', { slot: d.slot, x: bx, y: by, pts, hp: v.hp, net: true });
  }

  hurt(d, kind, o = {}) {
    if (d.control === 'remote' || d.finished || d.zoom > 0 || d.ifr > 0 || d.hug) return false;
    const nerve = d.def.nerve || 1;
    if (kind === 'soak') {
      d.soak = o.seconds || 0.9;
      d.vx += o.px || 0;
      d.vy += o.py || 0;
      d.ifr = 0.9;
    } else if (kind === 'cower') {
      d.cower = (o.seconds || 1.1) * nerve;
      d.ifr = d.cower + 0.4;
    } else if (kind === 'spook') {
      d.stun = (o.seconds || 0.6) * nerve;
      d.vx = o.px || 0;
      d.vy = o.py || 0;
      d.ifr = d.stun + 0.9;
    } else if (kind === 'net') {
      d.net = o.seconds || 1.5;
      d.wig = 0;
      d.vx = d.vy = 0;
      d.ifr = d.net + 1.0;
    }
    d.hits++;
    d.combo = 0;
    this.emit('hit', { slot: d.slot, kind, x: d.x, y: d.y });
    return true;
  }

  // ---------------------------------------------------------------- Bad Owners
  updateVillain(v, dt) {
    if (!v.alive) {
      v.eatT += dt;
      return;
    }
    if (v.flinch > 0) v.flinch = Math.max(0, v.flinch - dt);
    if (v.throwT > 0) v.throwT -= dt;
    if (v.swing > 0) v.swing -= dt;
    // Only act when a dog is anywhere near.
    let near = false;
    for (const d of this.dogs) {
      if (Math.abs(d.y - v.y) < 1500) {
        near = true;
        break;
      }
    }
    if (!near) return;
    const diff = this.diff;
    switch (v.type) {
      case 'hoser': this.hoser(v, dt, diff); break;
      case 'snatcher': this.snatcher(v, dt, diff, v.def, false); break;
      case 'yeller': this.yeller(v, dt, diff, v.def); break;
      case 'boomer': this.boomer(v, dt, diff, v.def); break;
      case 'chainer': v.t += dt; break;
      case 'boss': this.boss(v, dt); break;
    }
  }

  hoser(v, dt, diff) {
    const def = v.def;
    if (v.flinch > 0) {
      v.jet = null;
      return;
    }
    v.t += dt;
    const period = blend(def.period, diff), len = blend(def.jetLen, diff);
    const ang = Math.sin((v.t / period) * TAU + v.phase) * def.sweepDeg * (Math.PI / 180);
    const ox = v.x + v.dir * 30, oy = v.y;
    v.jet = { ox, oy, ex: ox + Math.cos(ang) * len * v.dir, ey: oy + Math.sin(ang) * len, w: def.jetWidth };
    v.face = ang;
    this.jetHits(v.jet, def.soakSeconds);
  }

  jetHits(j, seconds) {
    const L = Math.hypot(j.ex - j.ox, j.ey - j.oy) || 1;
    for (const d of this.dogs) {
      if (d.control === 'remote' || d.finished) continue;
      if (distSeg(d.x, d.y, j.ox, j.oy, j.ex, j.ey) < j.w / 2 + d.hr * 0.6) {
        this.hurt(d, 'soak', { seconds, px: ((j.ex - j.ox) / L) * 240, py: ((j.ey - j.oy) / L) * 240 });
      }
    }
  }

  snatcher(v, dt, diff, P, omni) {
    if (v.flinch > 0 && v.state !== 'recover') {
      v.state = 'recover';
      v.st = blend(P.recover, diff);
    }
    if (v.state === 'idle') v.state = 'patrol';
    if (v.state === 'patrol') {
      if (!omni) {
        v.x += v.dir * blend(P.speed, diff) * dt;
        if (v.x > this.W - 80) {
          v.x = this.W - 80;
          v.dir = -1;
        }
        if (v.x < 80) {
          v.x = 80;
          v.dir = 1;
        }
      }
      for (const d of this.dogs) {
        if (d.finished || d.hug || d.net > 0 || d.left) continue;
        let hit = false, ax = 0, ay = -1;
        if (omni) {
          const dd = dist(d.x, d.y, v.x, v.y);
          if (dd < P.range && dd > 20) {
            hit = true;
            ax = (d.x - v.x) / dd;
            ay = (d.y - v.y) / dd;
          }
        } else {
          const dy = v.y - d.y;
          hit = dy > 30 && dy < P.range && Math.abs(d.x - v.x) < 92;
        }
        if (hit) {
          v.state = 'windup';
          v.st = blend(P.windup, diff);
          v.aimX = ax;
          v.aimY = ay;
          this.emit('windup', { x: v.x, y: v.y });
          break;
        }
      }
    } else if (v.state === 'windup') {
      v.st -= dt;
      if (v.st <= 0) {
        const reach = P.netR + v.r - 2;
        const cx = v.x + v.aimX * reach, cy = v.y + v.aimY * reach;
        v.swing = 0.3;
        v.netX = cx;
        v.netY = cy;
        for (const d of this.dogs) {
          if (d.control === 'remote') continue;
          if (dist(d.x, d.y, cx, cy) < P.netR + d.hr * 0.5) this.hurt(d, 'net', { seconds: P.netSeconds });
        }
        this.emit('swing', { x: cx, y: cy });
        v.state = 'recover';
        v.st = blend(P.recover, diff);
      }
    } else if (v.state === 'recover') {
      v.st -= dt;
      if (v.st <= 0) v.state = 'patrol';
    }
  }

  yeller(v, dt, diff, P) {
    if (v.flinch > 0) {
      v.next = Math.max(v.next, 0.8);
      v.charge = 0;
      return;
    }
    v.next -= dt;
    v.charge = v.next < 0.5 ? 1 - v.next / 0.5 : 0;
    if (v.next <= 0) {
      this.ring(v, blend(P.ringR, diff), P.ringSpeed, P.cowerSeconds);
      v.next = blend(P.period, diff);
    }
  }

  ring(v, maxR, speed, seconds) {
    this.rings.push({ x: v.x, y: v.y, r: 30, maxR, speed, seconds, hit: {} });
    this.emit('yell', { x: v.x, y: v.y });
  }

  updateRings(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const g = this.rings[i];
      g.r += g.speed * dt;
      for (const d of this.dogs) {
        if (g.hit[d.slot] || d.control === 'remote') continue;
        if (Math.abs(dist(d.x, d.y, g.x, g.y) - g.r) < 16 + d.hr * 0.5) {
          g.hit[d.slot] = true;
          this.hurt(d, 'cower', { seconds: g.seconds });
        }
      }
      if (g.r >= g.maxR) this.rings.splice(i, 1);
    }
  }

  boomer(v, dt, diff, P) {
    if (v.flinch > 0) {
      v.next = Math.max(v.next, 0.9);
      return;
    }
    v.next -= dt;
    if (v.next > 0) return;
    let best = null, bd = P.range;
    for (const d of this.dogs) {
      if (d.finished || d.hug || d.left) continue;
      const dd = dist(d.x, d.y, v.x, v.y);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    if (!best) {
      v.next = 0.3;
      return;
    }
    const fuse = blend(P.fuse, diff);
    this.bomb(v, best.x + best.vx * fuse * 0.9, best.y + best.vy * fuse * 0.9, fuse, P.blastR, P.stunSeconds);
    v.next = blend(P.period, diff);
  }

  bomb(v, x, y, fuse, r, stun) {
    this.bombs.push({ x: clamp(x, 40, this.W - 40), y, t: fuse, fuse, r, stun, fx: v.x, fy: v.y });
    v.throwT = 0.35;
    this.emit('throw', { x: v.x, y: v.y });
  }

  updateBombs(dt) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.t -= dt;
      if (b.t > 0) continue;
      for (const d of this.dogs) {
        if (d.control === 'remote') continue;
        const dd = dist(d.x, d.y, b.x, b.y);
        if (dd < b.r + d.hr * 0.5) {
          const nx = dd > 4 ? (d.x - b.x) / dd : 0, ny = dd > 4 ? (d.y - b.y) / dd : -1;
          this.hurt(d, 'spook', { seconds: b.stun, px: nx * 360, py: ny * 360 - 120 });
        }
      }
      this.emit('pop', { x: b.x, y: b.y, r: b.r });
      this.bombs.splice(i, 1);
    }
  }

  boss(v, dt) {
    const P = v.def;
    if (v.invuln > 0) v.invuln -= dt;
    v.t += dt;
    const rage = 1 + (v.maxHp - v.hp) * 0.16;
    const live = this.dogs.filter((d) => !d.finished && !d.left && d.y > v.arena.y0 - 500);
    if (!live.length) return;
    // Roam between spots that every phone works out the same way.
    const speed = P.speed || 46;
    if (v.state !== 'windup' && v.state !== 'recover' && v.flinch <= 0) {
      const idx = Math.floor(this.t / 2.6);
      if (v.goalIdx !== idx || !v.goal) {
        v.goalIdx = idx;
        v.goal = this.bossSpot(v, 1000 + idx);
      }
      const dx = v.goal.x - v.x, dy = v.goal.y - v.y, L = Math.hypot(dx, dy);
      if (L > 4) {
        v.x += (dx / L) * Math.min(L, speed * dt);
        v.y += (dy / L) * Math.min(L, speed * dt);
      }
    }
    switch (v.kind) {
      case 'drench': {
        if (v.flinch > 0) {
          v.jets = null;
          break;
        }
        v.spinA = (v.spinA || 0) + P.spin * rage * dt;
        v.jets = [];
        for (let i = 0; i < P.jets; i++) {
          const a = v.spinA + (i / P.jets) * TAU;
          const j = {
            ox: v.x + Math.cos(a) * 44, oy: v.y + Math.sin(a) * 44,
            ex: v.x + Math.cos(a) * (44 + P.jetLen), ey: v.y + Math.sin(a) * (44 + P.jetLen), w: 54
          };
          v.jets.push(j);
          this.jetHits(j, 0.9);
        }
        break;
      }
      case 'captain':
        this.snatcher(v, dt * rage, 1, P, true);
        break;
      case 'bruno':
        if (v.flinch > 0) {
          v.next = Math.max(v.next, 0.7);
          break;
        }
        v.next -= dt * rage;
        if (v.next <= 0) {
          this.salvo(v, P, live);
          v.next = P.period;
        }
        break;
      case 'ringleader':
        this.snatcher(v, dt * rage, 1, P, true);
        if (v.flinch > 0) {
          v.next = Math.max(v.next, 0.7);
          v.charge = 0;
          break;
        }
        v.next -= dt * rage;
        v.charge = v.phase % 2 === 0 && v.next < 0.5 ? 1 - v.next / 0.5 : 0;
        if (v.next <= 0) {
          if (v.phase % 2 === 0) this.ring(v, P.ringR, P.ringSpeed, P.cowerSeconds);
          else this.salvo(v, P, live);
          v.phase++;
          v.next = P.period;
        }
        break;
    }
  }

  salvo(v, P, live) {
    const sorted = live.slice().sort((a, b) => dist(a.x, a.y, v.x, v.y) - dist(b.x, b.y, v.x, v.y));
    for (let i = 0; i < P.salvo; i++) {
      const d = sorted[i % sorted.length];
      const spread = i < sorted.length ? 0 : 120;
      const a = (i * 2.4 + this.t) % TAU;
      this.bomb(v, d.x + d.vx * P.fuse * 0.85 + Math.cos(a) * spread, d.y + d.vy * P.fuse * 0.85 + Math.sin(a) * spread, P.fuse + i * 0.12, P.blastR, P.stunSeconds);
    }
  }

  // ---------------------------------------------------------------- the cat
  updateCat(dt) {
    const c = this.cat, T = this.track, C = this.rules.cat;
    c.t += dt;
    if (c.state === 'sit' || c.state === 'tree') return;
    if (c.state === 'taunt' || c.state === 'windup') {
      for (const d of this.dogs) {
        if (d.control === 'remote' || d.finished || d.net > 0 || d.stun > 0) continue;
        if (dist(d.x, d.y, c.x, c.y) < d.r + 30) {
          this.tagCat(d);
          return;
        }
      }
      if (c.state === 'taunt') {
        for (const d of this.dogs) {
          const dy = c.y - d.y;
          if (dy < C.tauntTrigger && dy > -80) {
            c.state = 'windup';
            c.st = C.tauntWindup;
            this.emit('cat', { kind: 'alert', x: c.x, y: c.y });
            break;
          }
        }
      } else {
        c.st -= dt;
        if (c.st <= 0) this.catBolts();
      }
      return;
    }
    let lead = -1e9;
    for (const d of this.dogs) if (!d.left) lead = Math.max(lead, d.y);
    const next = T.taunts.find((t) => !t.done);
    let ty = lead + C.lead;
    let tx = this.W / 2 + Math.sin(c.y / 240) * 150;
    if (next && ty >= next.y) {
      ty = next.y;
      tx = next.x;
    }
    const bossUp = T.boss && T.boss.alive;
    const endY = bossUp ? T.gate.y : T.tree.y;
    if (ty >= endY) {
      ty = endY;
      tx = T.tree.x;
    }
    const sp = clamp((ty - c.y) * 3.2, 0, 1500);
    c.speed = sp;
    c.y = Math.min(ty, c.y + sp * dt);
    c.x += (tx - c.x) * Math.min(1, 5 * dt);
    c.perch = bossUp && c.y >= endY - 2;
    if (next && c.y >= next.y - 3) {
      c.state = 'taunt';
      c.taunt = next;
      c.x = next.x;
      c.y = next.y;
      c.speed = 0;
    } else if (!bossUp && c.y >= T.tree.y - 3) {
      c.state = 'tree';
      c.speed = 0;
    }
  }

  catBolts() {
    const c = this.cat;
    if (c.taunt) c.taunt.done = true;
    c.taunt = null;
    c.state = 'run';
    this.emit('cat', { kind: 'bolt', x: c.x, y: c.y });
  }

  tagCat(d) {
    const R = this.rules, c = this.cat;
    const id = c.taunt ? c.taunt.id : 0;
    d.tags++;
    const pts = this.award(d, R.points.catTag, 'tag');
    d.love += R.love.catTag;
    d.energy = Math.min(R.energy.maxPips, d.energy + R.energy.catTag);
    this.emit('tag', { id, slot: d.slot, x: c.x, y: c.y, pts, net: true });
    this.catBolts();
  }

  // ---------------------------------------------------------------- rival dogs
  aiInput(d, dt) {
    const a = d.ai, T = this.track, inp = d.input;
    // A light rubber band keeps the pack together without being obvious.
    const you = this.dogs.find((o) => o.control === 'local');
    let band = 1;
    if (you) band = 1 + clamp((you.y - d.y) / 3600, -0.05, 0.07);
    d.speedFactor = (0.78 + 0.2 * a.skill) * band;
    if (a.zoomCd > 0) a.zoomCd -= dt;

    const boss = T.boss;
    if (boss && boss.alive && d.y > T.arenaY + 60) {
      this.aiBoss(d, dt, boss);
      return;
    }
    a.stuckT += dt;
    if (a.stuckT > 1.1) {
      if (d.y - a.stuckY < 22 && !d.hug && d.net <= 0 && d.stun <= 0) {
        a.back = 0.42;
        a.side = this.rnd() < 0.5 ? -1 : 1;
        a.plan = 0;
      }
      a.stuckT = 0;
      a.stuckY = d.y;
    }
    if (a.back > 0) {
      a.back -= dt;
      inp.x = a.side;
      inp.y = -0.8;
      return;
    }
    a.plan -= dt;
    if (a.plan <= 0) {
      a.plan = 0.1 + (1 - a.skill) * 0.3;
      a.lane = this.pickLane(d);
    }
    let ix = clamp((a.lane - d.x) / 55, -1, 1);
    let iy = 1;
    if (blocked(T, d.x, d.y + d.r + 26, d.r - 2)) {
      if (Math.abs(a.lane - d.x) > 12) iy = 0.2;
      if (Math.abs(ix) < 0.6) ix = a.lane >= d.x ? 1 : -1;
    }
    inp.x = ix;
    inp.y = iy;

    if (d.energy >= 1 && d.zoom <= 0 && a.zoomCd <= 0) {
      let want = false;
      if (d.inWater && d.def.swim < 0.65) want = true;
      if (d.soak > 0.3 || d.cower > 0.3) want = true;
      if (d.energy >= this.rules.energy.maxPips - 0.05) want = true;
      const c = this.cat;
      if ((c.state === 'taunt' || c.state === 'windup') && c.y - d.y > 0 && c.y - d.y < 340 && Math.abs(c.x - d.x) < 90) want = true;
      for (const v of T.villains) {
        if (!v.alive || v.type !== 'snatcher') continue;
        const dy = v.y - d.y;
        if (dy > 60 && dy < 260 && Math.abs(v.x - d.x) < 90) want = true;
      }
      if (want && this.rnd() < 0.04 + a.skill * 0.2) {
        inp.zoom = true;
        a.zoomCd = 1;
      }
    }
  }

  pickLane(d) {
    const T = this.track, a = d.ai;
    const xs = [40, 90, 140, 190, 240, 290, 340, 390, 440];
    const samples = [[50, 1], [120, 0.9], [200, 0.75], [290, 0.6], [380, 0.45]];
    let best = d.x, bestCost = 1e9;
    for (const x of xs) {
      let cost = Math.abs(x - d.x) * 0.011 + this.rnd() * (1 - a.skill) * 1.4;
      for (const [dy, w] of samples) {
        const sy = d.y + dy;
        const px = d.x + (x - d.x) * Math.min(1, dy / 180);
        if (d.zoom <= 0 && inWater(T, px, sy)) cost += w * (1 - d.def.swim) * 2.4;
        if (blocked(T, px, sy, d.r + 4)) cost += w * 7;
      }
      for (const v of T.villains) {
        if (!v.alive || v.boss) continue;
        const dy = v.y - d.y;
        if (dy < -120 || dy > 560) continue;
        cost += this.villainCost(v, d, x, dy);
      }
      for (const b of this.bombs) {
        if (Math.abs(b.y - (d.y + 110)) < 170 && Math.abs(b.x - x) < b.r + 20) cost += 2.5;
      }
      for (const b of T.bones) {
        if (b.taken) continue;
        const dy = b.y - d.y;
        if (dy > 420) break;
        if (dy > 20 && Math.abs(b.x - x) < 40) cost -= 0.22;
      }
      for (const kd of T.kids) {
        if (kd.hugged[d.slot]) continue;
        const dy = kd.y - d.y;
        if (dy > 0 && dy < 420 && Math.abs(kd.x - x) < 100) cost += a.hugs ? -0.7 : 0.5;
      }
      for (const o of this.dogs) {
        if (o === d) continue;
        const dy = o.y - d.y;
        if (dy > 0 && dy < 130 && Math.abs(o.x - x) < 50) cost += 0.5;
      }
      const c = this.cat;
      if ((c.state === 'taunt' || c.state === 'windup') && c.y - d.y > 0 && c.y - d.y < 500 && Math.abs(c.x - x) < 40) cost -= 1.2;
      if (cost < bestCost) {
        bestCost = cost;
        best = x;
      }
    }
    return best;
  }

  villainCost(v, d, x, dy) {
    const ag = d.ai.aggr;
    switch (v.type) {
      case 'hoser': {
        const lateral = (x - v.x) * v.dir;
        if (lateral <= 56) return -1.6 * ag;
        if (lateral < blend(v.def.jetLen, this.diff) && dy > -80 && dy < 330) return 1.5;
        return 0;
      }
      case 'snatcher': {
        const dx = Math.abs(x - v.x);
        if (v.state === 'recover' || v.flinch > 0 || d.zoom > 0.4) return dx < 60 ? -2.2 * ag : 0;
        return dx < 120 && dy > 0 ? 2.0 : 0;
      }
      case 'chainer':
        return Math.abs(x - v.x) < 55 ? -1.7 * ag : 0;
      case 'yeller': {
        const dx = Math.abs(x - v.x);
        const safe = v.next > 0.9 || d.zoom > 0.4;
        if (dx < 55) return safe ? -1.8 * ag : 1.0;
        return !safe && dx < blend(v.def.ringR, this.diff) ? 0.9 : 0;
      }
      case 'boomer':
        return Math.abs(x - v.x) < 55 ? -1.5 * ag : 0;
    }
    return 0;
  }

  aiBoss(d, dt, boss) {
    const a = d.ai, inp = d.input;
    let tx = boss.x, ty = boss.y;
    // Computer dogs take turns going in, so the boss is not swarmed and you get your bites.
    const myTurn = (Math.floor(this.t / 2.4) + d.slot) % 2 === 0;
    const risky = !myTurn || boss.invuln > 0 || boss.state === 'windup' || (boss.charge || 0) > 0.2;
    if (a.wander > 0) a.wander -= dt;
    else if (this.rnd() < (1 - a.skill) * 0.6 * dt) a.wander = 0.6;
    if (risky || a.wander > 0) {
      const ang = Math.atan2(d.y - boss.y, d.x - boss.x) + 0.8 * a.orbit;
      tx = boss.x + Math.cos(ang) * 260;
      ty = boss.y + Math.sin(ang) * 260;
    }
    for (const b of this.bombs) {
      if (dist(d.x, d.y, b.x, b.y) < b.r + 40) {
        tx = d.x + (d.x - b.x) * 4;
        ty = d.y + (d.y - b.y) * 4 + 1;
      }
    }
    tx = clamp(tx, 40, this.W - 40);
    ty = clamp(ty, boss.arena.y0 - 220, boss.arena.y1 + 120);
    inp.x = clamp((tx - d.x) / 50, -1, 1);
    inp.y = clamp((ty - d.y) / 50, -1, 1);
    if (d.energy >= 1 && d.zoom <= 0 && a.zoomCd <= 0 && !risky) {
      if (dist(d.x, d.y, boss.x, boss.y) < 330 && this.rnd() < 0.03 + a.skill * 0.1) {
        inp.zoom = true;
        a.zoomCd = 1.2;
      }
    }
  }

  // ---------------------------------------------------------------- friend races
  // Compact state for one dog, sent to the other phones.
  stateOf(d) {
    let f = 0;
    if (d.zoom > 0) f |= 1;
    if (d.net > 0) f |= 2;
    if (d.stun > 0) f |= 4;
    if (d.hug) f |= 8;
    if (d.inWater) f |= 16;
    if (d.soak > 0) f |= 32;
    if (d.cower > 0) f |= 64;
    if (d.happy > 0) f |= 128;
    return [d.slot, Math.round(d.x), Math.round(d.y), Math.round(d.vx), Math.round(d.vy), f, Math.round(d.energy * 100) / 100, d.score, d.pups];
  }

  setRemote(s) {
    const d = this.dogs[s[0]];
    if (!d || d.control !== 'remote') return;
    d.tx = s[1];
    d.ty = s[2];
    d.vx = s[3];
    d.vy = s[4];
    const f = s[5];
    d.zoom = f & 1 ? 0.3 : 0;
    d.net = f & 2 ? 0.3 : 0;
    d.stun = f & 4 ? 0.3 : 0;
    d.inWater = !!(f & 16);
    d.soak = f & 32 ? 0.3 : 0;
    d.cower = f & 64 ? 0.3 : 0;
    d.happy = f & 128 ? 0.3 : 0;
    d.hugging = !!(f & 8);
    d.energy = s[6];
    d.score = s[7];
    d.pups = s[8];
  }

  // Something another phone's dog did: keep the shared world in step.
  applyRemote(ev) {
    const T = this.track;
    const d = this.dogs[ev.slot];
    switch (ev.type) {
      case 'bone': {
        const b = byId(T.bones, ev.id);
        if (b) b.taken = true;
        break;
      }
      case 'knock': {
        const k = byId(T.knocks, ev.id);
        if (k && !k.hit) {
          k.hit = true;
          k.vy = 260;
        }
        break;
      }
      case 'hug': {
        const kd = byId(T.kids, ev.id);
        if (kd) kd.hugged[ev.slot] = true;
        break;
      }
      case 'chomp': {
        const v = byId(T.villains, ev.id);
        if (v && v.alive) this.killVillain(v, ev.slot);
        if (d) d.belly = 0.6;
        break;
      }
      case 'bosshit':
      case 'bossdown': {
        const v = T.boss;
        if (v && v.alive) {
          if (ev.type === 'bossdown') v.hp = 1;
          this.hitBoss(v, ev.slot);
        }
        if (d) d.belly = 0.5;
        break;
      }
      case 'tag': {
        const t = byId(T.taunts, ev.id);
        if (t) t.done = true;
        if (this.cat.taunt && this.cat.taunt.id === ev.id) this.catBolts();
        break;
      }
      case 'zoom':
        if (d) d.bark = 0.45;
        break;
      case 'finish':
        if (d && ev.stats) Object.assign(d, ev.stats);
        if (d && !d.finished) {
          d.finished = true;
          d.time = ev.time;
          d.dnf = !!ev.dnf;
          d.place = ++this.placed;
          if (this.firstFinishT < 0 && !ev.dnf) this.firstFinishT = this.t;
        }
        break;
    }
    this.events.push(Object.assign({}, ev, { net: false, remote: true }));
  }

  // ---------------------------------------------------------------- results
  summary(slot) {
    const d = this.dogs[slot], P = this.rules.points, L = this.rules.love;
    const place = d.place || this.dogs.length;
    const bonus = (base) => Math.round((base * this.mult * d.scoreMult) / 10) * 10;
    const par = this.track.level.par;
    const placePts = bonus(P.place[place - 1] || 0);
    const timePts = d.dnf ? 0 : bonus(Math.max(0, par - d.time) * P.timeBonusPerSecond);
    const cleanPts = !d.dnf && d.hits === 0 ? bonus(P.cleanRun) : 0;
    const pupPts = bonus(d.pups * P.pup);
    let stars = 0;
    if (place <= this.rules.unlockPlace) stars = 1;
    if (place === 1 && !d.dnf) stars = d.time <= par ? 3 : 2;
    return {
      slot, place, dnf: d.dnf, time: d.time, par, stars,
      lines: [
        ['Bones', d.bones, d.pts.bone || 0],
        ['Hugs', d.hugs, d.pts.hug || 0],
        ['Bad Owners eaten', d.chomps, (d.pts.chomp || 0) + (d.pts.boss || 0)],
        ['Cat tags', d.tags, d.pts.tag || 0],
        ['Pups rescued', d.pups, pupPts],
        ['Finish place', place, placePts],
        ['Time bonus', null, timePts],
        ['Clean run', null, cleanPts]
      ],
      total: d.score + placePts + timePts + cleanPts + pupPts,
      love: d.love + (L.place[place - 1] || 0),
      chomps: d.chomps, hugs: d.hugs, pups: d.pups, hits: d.hits
    };
  }
}

function turnTo(a, b, k) {
  let diff = b - a;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return a + diff * k;
}
