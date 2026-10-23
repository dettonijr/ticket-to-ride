import type { Ticket } from '@railyard/engine';
import { cityName } from './TicketChoice';

export function Tickets({ tickets }: { tickets: readonly Ticket[] }) {
  return (
    <section aria-label="your tickets">
      <h2>Your tickets ({tickets.length})</h2>
      {tickets.length === 0 ? (
        <p className="muted">No tickets kept yet.</p>
      ) : (
        <ul className="ticket-list">
          {tickets.map((t) => (
            <li key={t.id} className="ticket">
              <span className="ticket-cities">
                <span>{cityName(t.from)}</span>
                <span className="muted">to</span>
                <span>{cityName(t.to)}</span>
              </span>
              <span className="ticket-points">{t.points}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
