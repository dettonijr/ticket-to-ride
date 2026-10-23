/**
 * Seeded pseudo-random generator (mulberry32). Pure: every call takes a state
 * and returns the value together with the next state.
 */
export type RngState = number;

export function seedRng(seed: number): RngState {
  return seed >>> 0;
}

/** Returns a float in [0, 1) and the next state. */
export function nextFloat(state: RngState): [number, RngState] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Returns an integer in [0, max) and the next state. */
export function nextInt(state: RngState, max: number): [number, RngState] {
  const [f, next] = nextFloat(state);
  return [Math.floor(f * max), next];
}

/** Fisher-Yates shuffle returning a new array and the next state. */
export function shuffle<T>(items: readonly T[], state: RngState): [T[], RngState] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(s, i + 1);
    s = next;
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return [out, s];
}
