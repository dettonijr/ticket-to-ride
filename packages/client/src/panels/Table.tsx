import type { Card } from '@railyard/engine';

/** The shared table: face-up cards and the deck counters, clickable when a draw is legal. */
export function Table({
  faceUp,
  trainDeckSize,
  discardSize,
  ticketDeckSize,
  faceUpIndexes,
  canDrawBlind,
  onDrawFaceUp,
  onDrawBlind,
}: {
  faceUp: readonly Card[];
  trainDeckSize: number;
  discardSize: number;
  ticketDeckSize: number;
  /** Face-up slots the viewer may take right now; empty when drawing is not legal. */
  faceUpIndexes: readonly number[];
  canDrawBlind: boolean;
  onDrawFaceUp: (index: number) => void;
  onDrawBlind: () => void;
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
              disabled={!faceUpIndexes.includes(i)}
              aria-label={`face-up ${card}`}
              onClick={() => onDrawFaceUp(i)}
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
            disabled={!canDrawBlind}
            aria-label={`train deck, ${trainDeckSize} cards`}
            onClick={onDrawBlind}
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
