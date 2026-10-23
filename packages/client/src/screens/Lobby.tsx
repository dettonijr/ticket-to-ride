import { MAX_PLAYERS, MIN_PLAYERS } from '@railyard/engine';
import { PLAYER_FILL } from '../board/Board';
import { client, type LobbyPlayer } from '../ws';

export function Lobby({
  code,
  players,
  playerId,
  hostId,
  rejection,
}: {
  code: string;
  players: LobbyPlayer[];
  playerId: string;
  hostId: string;
  rejection: string | undefined;
}) {
  const isHost = playerId === hostId;
  const canStart = players.length >= MIN_PLAYERS && players.length <= MAX_PLAYERS;
  return (
    <main className="home">
      <h1>Railyard</h1>
      <p className="muted">Share this code with your friends.</p>
      <p className="join-code" aria-label="join code">
        {code}
      </p>
      <h2>
        Players ({players.length} of {MAX_PLAYERS})
      </h2>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'disconnected'}>
            <span className="swatch" style={{ background: PLAYER_FILL[p.colour] }} aria-hidden />
            {p.name}
            {p.id === hostId && <span className="tag">host</span>}
            {p.id === playerId && <span className="tag">you</span>}
            {!p.connected && <span className="tag">disconnected</span>}
          </li>
        ))}
      </ul>
      {rejection && (
        <p className="rejection" role="alert">
          {rejection}
        </p>
      )}
      {isHost ? (
        <button
          type="button"
          className="primary"
          disabled={!canStart}
          onClick={() => client.send({ type: 'start' })}
        >
          {canStart ? 'Start game' : `Waiting for ${MIN_PLAYERS - players.length} more`}
        </button>
      ) : (
        <p className="muted">Waiting for the host to start.</p>
      )}
      <button type="button" className="link" onClick={() => client.leave()}>
        Leave
      </button>
    </main>
  );
}
