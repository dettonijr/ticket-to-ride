import type { Card } from '@railyard/engine';
import { CardFace, cardClass } from './Card';

/** The shared table: face-up cards and the deck, clickable when a draw is legal. */
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
      <div className="table-row">
        <ul className="face-up" aria-label="face-up cards">
          {faceUp.map((card, i) => (
            <li key={i}>
              <button
                type="button"
                className={cardClass(card)}
                id={`face-up-${i}`}
                disabled={!faceUpIndexes.includes(i)}
                aria-label={`face-up ${card}`}
                title={card}
                onClick={() => onDrawFaceUp(i)}
              >
                <CardFace />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={cardClass('deck')}
          id="train-deck"
          disabled={!canDrawBlind}
          aria-label={`train deck, ${trainDeckSize} cards`}
          title="Draw from the deck"
          onClick={onDrawBlind}
        >
          <CardFace count={trainDeckSize} />
        </button>
      </div>
      <p className="muted meta">
        Deck {trainDeckSize} · Discard {discardSize} · Tickets {ticketDeckSize}
      </p>
    </section>
  );
}
