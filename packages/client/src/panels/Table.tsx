import type { Card } from '@railyard/engine';

/** The shared table: face-up cards and the deck counters. Clicks arrive in a later ticket. */
export function Table({
  faceUp,
  trainDeckSize,
  discardSize,
  ticketDeckSize,
  canDraw,
}: {
  faceUp: readonly Card[];
  trainDeckSize: number;
  discardSize: number;
  ticketDeckSize: number;
  canDraw: boolean;
}) {
  return (
    <section aria-label="table">
      <h2>Table</h2>
      <ul className="face-up" aria-label="face-up cards">
        {faceUp.map((card, i) => (
          <li key={i}>
            <button
              type="button"
              className={`card card-${card}`}
              id={`face-up-${i}`}
              disabled={!canDraw}
              aria-label={`face-up ${card}`}
            >
              {card}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="card card-deck"
            id="train-deck"
            disabled={!canDraw}
            aria-label={`train deck, ${trainDeckSize} cards`}
          >
            Deck {trainDeckSize}
          </button>
        </li>
      </ul>
      <p className="muted">
        Discard {discardSize} · Tickets {ticketDeckSize}
      </p>
    </section>
  );
}
