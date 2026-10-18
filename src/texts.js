// Haiku (GDD 8). The poems are built into the app and work offline.
const DAY_MS = 86400000;
const NORTH_SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
const OPPOSITE = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };

let haiku = null;

export async function loadTexts() {
  haiku = await fetch('src/data/haiku.json').then(r => r.json());
}

// UTC day — the shared “seed of the day” for all players.
export function dayIndex(tMs) {
  return Math.floor(tMs / DAY_MS);
}

export function seasonFor(tMs, hemisphere) {
  const season = NORTH_SEASONS[new Date(tMs).getMonth()];
  return hemisphere === 'S' ? OPPOSITE[season] : season;
}

function hash(n) {
  let x = (n | 0) + 0x6d2b79f5;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return (x ^ (x >>> 14)) >>> 0;
}

// moment: { index, at, hemisphere, nth } — the haiku moment; nth is this spirit's haiku number that day (from 0).
export function pickHaiku(animal, moment) {
  const pool = haiku[animal][seasonFor(moment.at, moment.hemisphere)];
  const i = (hash(dayIndex(moment.at) * 131 + moment.index) + moment.nth) % pool.length;
  return pool[i];
}

// Preview of a specific poem (developer mode).
export function haikuFor(animal, season, i) {
  const pool = haiku[animal][season];
  return pool[((i % pool.length) + pool.length) % pool.length];
}
