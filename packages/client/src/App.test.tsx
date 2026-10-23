import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { client } from './ws';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('shows the Railyard home screen with create and join', () => {
    vi.spyOn(client, 'connect').mockImplementation(() => {});
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Railyard' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Create a game' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Join a game' })).toBeInTheDocument();
  });

  it('shows the lobby with the join code once seated', () => {
    vi.spyOn(client, 'connect').mockImplementation(() => {});
    render(<App />);
    act(() => {
      client.receive({ type: 'joined', code: 'ABCDEF', playerId: 'p1', token: 't', hostId: 'p1' });
      client.receive({
        type: 'lobby',
        code: 'ABCDEF',
        hostId: 'p1',
        players: [{ id: 'p1', name: 'Ann', colour: 'blue', connected: true }],
      });
    });
    expect(screen.getByLabelText('join code')).toHaveTextContent('ABCDEF');
    expect(screen.getByRole('button', { name: /Waiting for 1 more/ })).toBeDisabled();
    act(() => client.leave());
  });
});
