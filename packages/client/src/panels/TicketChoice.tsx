import { useState } from 'react';
import { CITY_BY_ID, type Ticket, type TicketId } from '@railyard/engine';

export function cityName(id: string): string {
  return CITY_BY_ID.get(id)?.name ?? id;
}

/** Pick which of the drawn tickets to keep. Used at setup and after drawing tickets. */
export function TicketChoice({
  tickets,
  minKeep,
  onKeep,
  title = 'Choose your tickets',
}: {
  tickets: Ticket[];
  minKeep: number;
  onKeep: (keep: TicketId[]) => void;
  title?: string;
}) {
  const [chosen, setChosen] = useState<Set<TicketId>>(() => new Set());
  const toggle = (id: TicketId) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const keep = tickets.filter((t) => chosen.has(t.id)).map((t) => t.id);
  return (
    <section className="dialog" role="dialog" aria-labelledby="ticket-choice-title">
      <h2 id="ticket-choice-title">{title}</h2>
      <p className="muted">
        Keep at least {minKeep}. Each ticket scores its points if you connect the two cities, and
        loses them if you do not.
      </p>
      <ul className="ticket-list">
        {tickets.map((t) => (
          <li key={t.id}>
            <label className={`ticket ${chosen.has(t.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                id={`ticket-${t.id}`}
                checked={chosen.has(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span className="ticket-cities">
                <span>{cityName(t.from)}</span>
                <span className="muted">to</span>
                <span>{cityName(t.to)}</span>
              </span>
              <span className="ticket-points">{t.points}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="primary"
        id="keep-tickets"
        disabled={keep.length < minKeep}
        onClick={() => onKeep(keep)}
      >
        Keep {keep.length} ticket{keep.length === 1 ? '' : 's'}
      </button>
    </section>
  );
}
