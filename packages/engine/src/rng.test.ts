import { describe, expect, it } from 'vitest';
import { nextInt, seedRng, shuffle } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const [a] = shuffle([1, 2, 3, 4, 5, 6, 7, 8], seedRng(42));
    const [b] = shuffle([1, 2, 3, 4, 5, 6, 7, 8], seedRng(42));
    expect(a).toEqual(b);
  });

  it('differs between seeds', () => {
    const [a] = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seedRng(1));
    const [b] = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seedRng(2));
    expect(a).not.toEqual(b);
  });

  it('does not mutate its input and keeps every item', () => {
    const input = [1, 2, 3, 4, 5];
    const [out] = shuffle(input, seedRng(7));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('stays within bounds', () => {
    let s = seedRng(3);
    for (let i = 0; i < 200; i++) {
      const [n, next] = nextInt(s, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      s = next;
    }
  });
});
