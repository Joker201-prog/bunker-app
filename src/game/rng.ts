/** Replaceable random source so the engine can be tested deterministically. */
export const rng = { next: (): number => Math.random() };

export function setRandom(fn: () => number): void {
  rng.next = fn;
}

/** Small seeded generator (mulberry32) for tests and simulations. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function int(min: number, max: number): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)];
}

export function chance(p: number): boolean {
  return rng.next() < p;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
