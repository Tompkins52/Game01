// Plays every level with four computer dogs and checks that each race can be finished.
// Run: node tests/sim.test.mjs            (add --par to print suggested par times)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTrack } from '../js/track.js';
import { Race, DT } from '../js/sim.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const rules = load('rules.json'), dogsFile = load('dogs.json'), villains = load('villains.json'), levels = load('levels.json');
const dogDefs = Object.fromEntries(dogsFile.dogs.map((d) => [d.id, d]));
const showPar = process.argv.includes('--par');
const lerp = (a, b, t) => a + (b - a) * t;

function run(level, dogIds, skill, seed) {
  const world = levels.worlds.find((w) => w.id === level.world);
  const track = buildTrack(level, world, rules, villains, levels.levels.length);
  const racers = dogIds.map((id, slot) => ({ slot, dogId: id, control: 'ai', dogLevel: 1 }));
  const race = new Race({ track, rules, dogDefs, racers, seed, npc: { skill, aggression: 0.6 } });
  let steps = 0;
  const counts = {};
  while (race.phase !== 'over' && steps < 60 * 400) {
    race.step(DT);
    for (const e of race.events) counts[e.type] = (counts[e.type] || 0) + 1;
    race.events.length = 0;
    steps++;
  }
  return { race, track, counts };
}

let failed = 0;
const rows = [];
for (const level of levels.levels) {
  const d = (level.id - 1) / (levels.levels.length - 1);
  const skill = lerp(levels.npc.skill[0], levels.npc.skill[1], d);
  const times = [];
  let dnf = 0, chomps = 0, hugs = 0, hits = 0, tags = 0, villainsLeft = 0, total = 0;
  const packs = [
    ['pitbull', 'greyhound', 'labrador', 'shepherd'],
    ['corgi', 'husky', 'chihuahua', 'pitbull'],
    ['greyhound', 'pitbull', 'labrador', 'husky'],
    ['zazu', 'shepherd', 'corgi', 'chihuahua']
  ];
  let fast = 1e9;
  packs.forEach((pack, i) => {
    const { race, track, counts } = run(level, pack, i >= 2 ? 0.95 : skill, 100 + i);
    for (const dog of race.dogs) {
      if (dog.dnf) dnf++;
      else times.push(dog.time);
      chomps += dog.chomps; hugs += dog.hugs; hits += dog.hits; tags += dog.tags;
      if (!Number.isFinite(dog.x) || !Number.isFinite(dog.y)) { console.error('NaN position', level.id, dog.id); failed++; }
    }
    if (i === 2) fast = Math.min(...race.dogs.filter((x) => !x.dnf).map((x) => x.time));
    villainsLeft += track.villains.filter((v) => v.alive).length;
    total += track.villainCount;
    if (track.boss && track.boss.alive) { console.error('Boss still alive on level', level.id, 'pack', i); failed++; }
    void counts;
  });
  const best = Math.min(...times), worst = Math.max(...times);
  if (dnf > 0) { console.error(`Level ${level.id}: ${dnf} dogs did not finish`); failed++; }
  rows.push({ level: level.id, name: level.name, par: level.par, best: +best.toFixed(1), worst: +worst.toFixed(1), fastBot: +fast.toFixed(1), chomps, eaten: `${total - villainsLeft}/${total}`, hugs, hits, tags, dnf });
}
console.table(rows);
if (showPar) {
  console.log(JSON.stringify(Object.fromEntries(rows.map((r) => [r.level, Math.ceil(r.fastBot * 1.06)]))));
}
if (failed) { console.error(`FAILED: ${failed} problem(s)`); process.exit(1); }
console.log('All levels can be finished.');
