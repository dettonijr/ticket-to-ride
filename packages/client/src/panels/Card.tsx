import type { Card as CardKind } from '@railyard/engine';

/** The train silhouette printed on every card face. */
export function TrainSilhouette() {
  return (
    <svg className="card-train" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
      <rect x="2" y="4" width="30" height="13" rx="3" />
      <rect x="31" y="8" width="7" height="9" rx="2" />
      <circle cx="9" cy="20" r="3" />
      <circle cx="25" cy="20" r="3" />
    </svg>
  );
}

/** Class list for a card of the given kind, with the shared `card` base. */
export function cardClass(card: CardKind | 'deck', extra?: string): string {
  return ['card', `card-${card}`, extra].filter(Boolean).join(' ');
}

/**
 * The inside of a card: the silhouette plus an optional count badge. The outer
 * element (a `button`, `li` or `span`) carries the `card card-<kind>` classes
 * so it can be interactive or static as the panel needs.
 */
export function CardFace({ count }: { count?: string | number | undefined }) {
  return (
    <span className="card-face">
      <TrainSilhouette />
      {count !== undefined && <span className="card-count">{count}</span>}
    </span>
  );
}
