import type { PlayerView } from '@railyard/engine';
import { PLAYER_FILL } from '../board/Board';
import type { Presence } from '../ws';

export function Players({ view, presence }: { view: PlayerView; presence?: Presence | undefined }) {
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
          const connected = presence?.[id] ?? true;
          const classes = [current ? 'current' : '', connected ? '' : 'disconnected']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={id} className={classes} data-testid={`player-${id}`}>
              <span className="swatch" style={{ background: PLAYER_FILL[p.colour] }} aria-hidden />
              <span className="name">
                {p.name}
                {p.id === view.me.id && <span className="tag">you</span>}
                {current && (
                  <span className="tag">{p.id === view.me.id ? 'your turn' : 'their turn'}</span>
                )}
                {waiting && <span className="tag">choosing</span>}
                {!connected && <span className="tag">disconnected</span>}
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
