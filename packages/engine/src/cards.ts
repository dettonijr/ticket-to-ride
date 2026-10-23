import type { Card } from './state';

/** How many of each card a list holds, in first-seen order. */
export function countCards(cards: readonly Card[]): Map<Card, number> {
  const counts = new Map<Card, number>();
  for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts;
}
