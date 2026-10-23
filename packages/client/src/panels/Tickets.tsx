import { isTicketCompleted, type PlayerId, type RouteId, type Ticket } from '@railyard/engine';
import { cityName } from './TicketChoice';

/** Kept tickets with a live completed marker, plus the Draw tickets action. */
export function Tickets({
  tickets,
  claimed,
  playerId,
  canDraw,
  onDraw,
}: {
  tickets: readonly Ticket[];
  claimed: Readonly<Record<RouteId, PlayerId>>;
  playerId: PlayerId;
  canDraw: boolean;
  onDraw: () => void;
}) {
  return (
    <section aria-label="your tickets">
      <h2>Your tickets ({tickets.length})</h2>
      {tickets.length === 0 ? (
        <p className="muted">No tickets kept yet.</p>
      ) : (
        <ul className="ticket-list">
          {tickets.map((t) => {
            const done = isTicketCompleted(claimed, playerId, t);
            const label = `${cityName(t.from)} to ${cityName(t.to)}`;
            return (
              <li
                key={t.id}
                className={`ticket ${done ? 'completed' : ''}`}
                aria-label={`${label}, ${t.points} points, ${done ? 'completed' : 'not completed'}`}
                data-completed={done ? 'true' : 'false'}
              >
                <span className="ticket-cities">
                  <span>{cityName(t.from)}</span>
                  <span className="muted">to</span>
                  <span>{cityName(t.to)}</span>
                </span>
                <span className="ticket-status" aria-hidden="true">
                  {done ? '✓' : ''}
                </span>
                <span className="ticket-points">{t.points}</span>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className="secondary"
        id="draw-tickets"
        disabled={!canDraw}
        onClick={onDraw}
      >
        Draw tickets
      </button>
    </section>
  );
}
