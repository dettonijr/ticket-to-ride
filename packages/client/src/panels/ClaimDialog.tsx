import { useState } from 'react';
import {
  cityName,
  claimOptions,
  countCards,
  ROUTE_POINTS,
  type Card,
  type Route,
} from '@railyard/engine';

/** One way to pay, as a short label: "2 red" or "1 green + 1 locomotive". */
export function describeOption(cards: readonly Card[]): string {
  return [...countCards(cards).entries()].map(([card, n]) => `${n} ${card}`).join(' + ');
}

/** Choose which cards to spend on a route, then claim it. */
export function ClaimDialog({
  route,
  hand,
  onClaim,
  onCancel,
}: {
  route: Route;
  hand: readonly Card[];
  onClaim: (cards: Card[]) => void;
  onCancel: () => void;
}) {
  const options = claimOptions(hand, route);
  const [chosen, setChosen] = useState(0);
  const selected = options[chosen];
  return (
    <section className="dialog" role="dialog" aria-labelledby="claim-title">
      <h2 id="claim-title">
        Claim {cityName(route.from)} to {cityName(route.to)}
      </h2>
      <p className="muted">
        {route.length} space{route.length === 1 ? '' : 's'}, {route.colour} route, worth{' '}
        {ROUTE_POINTS[route.length]} point{ROUTE_POINTS[route.length] === 1 ? '' : 's'}.
      </p>
      <ul className="ticket-list" aria-label="ways to pay">
        {options.map((cards, i) => (
          <li key={i}>
            <label className={`ticket ${i === chosen ? 'selected' : ''}`}>
              <input
                type="radio"
                name="claim-option"
                id={`claim-option-${i}`}
                checked={i === chosen}
                onChange={() => setChosen(i)}
              />
              <span className="ticket-cities">{describeOption(cards)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button
          type="button"
          className="primary"
          id="claim-route"
          disabled={!selected}
          onClick={() => selected && onClaim(selected)}
        >
          Claim route
        </button>
        <button type="button" className="link" id="cancel-claim" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
