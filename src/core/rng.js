/**
 * rng.js — Seedable pseudo-random number generator.
 *
 * Shuffling questions is good for study but hostile to automation, so shuffling
 * is always driven by an explicit seed. Passing `?seed=42` makes a run
 * byte-for-byte reproducible; the seed is also stored with every attempt so a
 * past attempt can be replayed exactly.
 */

/** mulberry32 — small, fast, good enough for question order. */
export function createRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates using a seeded RNG. Returns a new array. */
export function shuffle(items, seed) {
  const rng = createRng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31) >>> 0;
