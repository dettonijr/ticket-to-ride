import {
  LONGEST_PATH_BONUS,
  type PlayerColour,
  type PlayerId,
  type PlayerResult,
  type PlayerView,
} from '@railyard/engine';
import { Board, PLAYER_FILL } from '../board/Board';
import { cityName } from '../panels/TicketChoice';

function ticketLines(result: PlayerResult, completed: boolean) {
  const tickets = result.tickets.filter((t) => t.completed === completed);
  if (tickets.length === 0) return <span className="muted">none</span>;
  return (
    <ul className="summary-tickets">
      {tickets.map(({ ticket }) => (
        <li key={ticket.id} data-testid={`ticket-${ticket.id}`}>
          {cityName(ticket.from)} to {cityName(ticket.to)}{' '}
          <span className="muted">
            {completed ? '+' : '−'}
            {ticket.points}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The end of the game: ranking, every player's revealed tickets, and the final board. */
export function Summary({ view }: { view: PlayerView }) {
  const result = view.result;
  const playerColours: Record<PlayerId, PlayerColour> = {};
  const names: Record<PlayerId, string> = {};
  for (const p of view.players) {
    playerColours[p.id] = p.colour;
    names[p.id] = p.name;
  }
  if (!result) {
    return (
      <main className="home">
        <h1>Game over</h1>
        <p className="muted">Waiting for the final scores.</p>
      </main>
    );
  }
  const byId = new Map(result.players.map((p) => [p.playerId, p]));
  const ordered = result.ranking.map((id) => byId.get(id)!).filter(Boolean);
  const winners = new Set(result.winnerIds);

  return (
    <main className="game summary">
      <section className="board-wrap">
        <h1>Game over</h1>
        <ol className="player-list ranking" aria-label="ranking">
          {ordered.map((p, i) => (
            <li key={p.playerId} className={winners.has(p.playerId) ? 'current' : ''}>
              <span className="rank">{i + 1}.</span>
              <span
                className="swatch"
                style={{ background: PLAYER_FILL[playerColours[p.playerId] ?? 'black'] }}
                aria-hidden
              />
              <span className="name">
                {names[p.playerId] ?? p.playerId}
                {p.playerId === view.me.id && <span className="tag">you</span>}
                {winners.has(p.playerId) && <span className="tag winner">Winner</span>}
              </span>
              <span className="stats">{p.total} pts</span>
            </li>
          ))}
        </ol>
        <div className="table-wrap">
          <table className="breakdown" aria-label="score breakdown">
            <thead>
              <tr>
                <th scope="col"></th>
                {ordered.map((p) => (
                  <th scope="col" key={p.playerId}>
                    {names[p.playerId] ?? p.playerId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Routes</th>
                {ordered.map((p) => (
                  <td key={p.playerId}>{p.routePoints}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Tickets completed</th>
                {ordered.map((p) => (
                  <td key={p.playerId}>{ticketLines(p, true)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Tickets failed</th>
                {ordered.map((p) => (
                  <td key={p.playerId}>{ticketLines(p, false)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Longest path</th>
                {ordered.map((p) => (
                  <td key={p.playerId}>
                    {p.longestPath} spaces
                    {p.longestPathBonus && <span className="muted"> +{LONGEST_PATH_BONUS}</span>}
                  </td>
                ))}
              </tr>
              <tr className="total-row">
                <th scope="row">Total</th>
                {ordered.map((p) => (
                  <td key={p.playerId} data-testid={`total-${p.playerId}`}>
                    {p.total}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <button
            type="button"
            className="primary"
            id="rematch"
            disabled
            title="Rematch is coming in the next ticket"
          >
            Rematch
          </button>
        </p>
        <Board claimed={view.claimed} playerColours={playerColours} />
      </section>
    </main>
  );
}
