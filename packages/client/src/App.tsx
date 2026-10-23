import { useEffect } from 'react';
import { client, useClientState } from './ws';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Game } from './screens/Game';

export function App() {
  const state = useClientState();

  useEffect(() => {
    client.connect();
  }, []);

  if (state.connection === 'closed') {
    return (
      <main className="home">
        <h1>Railyard</h1>
        <p className="rejection" role="alert">
          Lost the connection to the server. Reload the page to reconnect.
        </p>
      </main>
    );
  }

  if (state.view && state.playerId) {
    return <Game view={state.view} rejection={state.rejection} />;
  }

  if (state.code && state.playerId && state.hostId && state.lobby) {
    return (
      <Lobby
        code={state.code}
        players={state.lobby}
        playerId={state.playerId}
        hostId={state.hostId}
        rejection={state.rejection}
      />
    );
  }

  return <Home rejection={state.rejection} />;
}
