import type { PlayerView } from '@railyard/engine';
import { PLAYER_FILL } from '../board/Board';

export function Players({ view }: { view: PlayerView }) {
  const inSetup = view.phase === 'setup';
  return (
    <section aria-label="players">
      <h2>Players</h2>
      <ol className="player-list">
        {view.turnOrder.map((id) => {
          const p = view.players.find((x) => x.id === id);
          if (!p) return null;
          const current = !inSetup && view.currentPlayer === id;
          const waiting = inSetup && view.waitingOn.includes(id);
          return (
            <li key={id} className={current ? 'current' : ''} data-testid={`player-${id}`}>
              <span className="swatch" style={{ background: PLAYER_FILL[p.colour] }} aria-hidden />
              <span className="name">
                {p.name}
                {p.id === view.me.id && <span className="tag">you</span>}
                {current && <span className="tag">their turn</span>}
                {waiting && <span className="tag">choosing</span>}
              </span>
              <span className="stats">
                {p.score} pts · {p.trainsLeft} trains · {p.handSize} cards · {p.ticketCount} tickets
              </span>
            </li>
          );
        })}
      </ol>
      {view.lastAction && (
        <p className="muted last-action" aria-live="polite">
          {view.lastAction.description}
        </p>
      )}
    </section>
  );
}
