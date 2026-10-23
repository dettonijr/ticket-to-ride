import { COLOURS, countCards, type Card } from '@railyard/engine';

const ORDER: Card[] = [...COLOURS, 'locomotive'];

/** Group a hand by colour, in the fixed colour order, dropping empty groups. */
export function groupHand(hand: readonly Card[]): Array<{ card: Card; count: number }> {
  const counts = countCards(hand);
  return ORDER.filter((c) => counts.has(c)).map((c) => ({ card: c, count: counts.get(c) ?? 0 }));
}

export function Hand({ hand }: { hand: readonly Card[] }) {
  return (
    <section aria-label="your hand">
      <h2>Your hand ({hand.length})</h2>
      {hand.length === 0 ? (
        <p className="muted">No train cards yet.</p>
      ) : (
        <ul className="hand">
          {groupHand(hand).map(({ card, count }) => (
            <li key={card} className={`card card-${card}`} data-testid={`hand-${card}`}>
              {card} <strong>×{count}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
