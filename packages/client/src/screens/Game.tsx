import type { PlayerColour, PlayerId, PlayerView } from '@railyard/engine';
import { Board, PLAYER_FILL } from '../board/Board';

export function Game({ view }: { view: PlayerView }) {
  const playerColours: Record<PlayerId, PlayerColour> = {};
  for (const p of view.players) playerColours[p.id] = p.colour;
  const me = view.players.find((p) => p.id === view.me.id);
  return (
    <main className="game">
      <section className="board-wrap">
        <Board claimed={view.claimed} playerColours={playerColours} />
      </section>
      <aside className="sidebar">
        <h2>Players</h2>
        <ol className="player-list">
          {view.turnOrder.map((id) => {
            const p = view.players.find((x) => x.id === id);
            if (!p) return null;
            const current = view.currentPlayer === id;
            return (
              <li key={id} className={current ? 'current' : ''}>
                <span
                  className="swatch"
                  style={{ background: PLAYER_FILL[p.colour] }}
                  aria-hidden
                />
                <span className="name">
                  {p.name}
                  {p.id === view.me.id && <span className="tag">you</span>}
                </span>
                <span className="stats">
                  {p.score} pts · {p.trainsLeft} trains · {p.handSize} cards · {p.ticketCount}{' '}
                  tickets
                </span>
              </li>
            );
          })}
        </ol>
        <h2>Table</h2>
        <p className="muted">
          Deck {view.trainDeckSize} · Discard {view.discardSize} · Tickets {view.ticketDeckSize}
        </p>
        <ul className="face-up">
          {view.faceUp.map((card, i) => (
            <li key={i} className={`card card-${card}`}>
              {card}
            </li>
          ))}
        </ul>
        <h2>Your hand ({me?.handSize ?? view.me.hand.length})</h2>
        <ul className="hand">
          {view.me.hand.map((card, i) => (
            <li key={i} className={`card card-${card}`}>
              {card}
            </li>
          ))}
        </ul>
        <p className="muted">Phase: {view.phase}</p>
      </aside>
    </main>
  );
}
