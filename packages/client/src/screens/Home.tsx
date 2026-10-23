import { useState, type FormEvent } from 'react';
import { PLAYER_COLOURS, type PlayerColour } from '@railyard/engine';
import { client } from '../ws';
import { ColourPicker } from './ColourPicker';

export function Home({ rejection }: { rejection: string | undefined }) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [colour, setColour] = useState<PlayerColour>(PLAYER_COLOURS[0]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'create') client.send({ type: 'create', name, colour });
    else client.send({ type: 'join', code: code.trim().toUpperCase(), name, colour });
  };

  return (
    <main className="home">
      <h1>Railyard</h1>
      <p className="muted">Online Ticket to Ride for two to five friends.</p>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          onClick={() => setMode('create')}
        >
          Create a game
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'join'}
          onClick={() => setMode('join')}
        >
          Join a game
        </button>
      </div>
      <form onSubmit={submit} className="stack">
        {mode === 'join' && (
          <label>
            Join code
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoCapitalize="characters"
              required
            />
          </label>
        )}
        <label>
          Nickname
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
          />
        </label>
        <ColourPicker value={colour} onChange={setColour} taken={[]} />
        {rejection && (
          <p className="rejection" role="alert">
            {rejection}
          </p>
        )}
        <button type="submit" className="primary">
          {mode === 'create' ? 'Create game' : 'Join game'}
        </button>
      </form>
    </main>
  );
}
