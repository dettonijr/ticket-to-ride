import { describe, expect, it } from 'vitest';
import { GameClient, socketUrl } from './ws';

describe('socketUrl', () => {
  it('derives ws or wss from the page origin', () => {
    expect(socketUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/ws');
    expect(socketUrl({ protocol: 'https:', host: 'rail.example' })).toBe('wss://rail.example/ws');
  });
});

describe('GameClient store', () => {
  it('records the seat on joined and the room on lobby', () => {
    const c = new GameClient('ws://unused');
    c.receive({ type: 'joined', code: 'ABCDEF', playerId: 'p1', token: 't', hostId: 'p1' });
    expect(c.getState()).toMatchObject({ code: 'ABCDEF', playerId: 'p1', hostId: 'p1' });
    c.receive({
      type: 'lobby',
      code: 'ABCDEF',
      hostId: 'p1',
      players: [{ id: 'p1', name: 'Ann', colour: 'blue', connected: true }],
    });
    expect(c.getState().lobby?.map((p) => p.name)).toEqual(['Ann']);
    expect(localStorage.getItem('railyard.token')).toBe('t');
  });

  it('records who is connected from each snapshot', () => {
    const c = new GameClient('ws://unused');
    c.receive({
      type: 'snapshot',
      view: { phase: 'setup' } as never,
      presence: [
        { id: 'p1', connected: true },
        { id: 'p2', connected: false },
      ],
    });
    expect(c.getState().presence).toEqual({ p1: true, p2: false });
  });

  it('forgets a token the server no longer knows and shows why', () => {
    const c = new GameClient('ws://unused');
    c.receive({ type: 'joined', code: 'ABCDEF', playerId: 'p1', token: 'stale', hostId: 'p1' });
    expect(localStorage.getItem('railyard.token')).toBe('stale');
    c.receive({ type: 'rejected', code: 'unknown-token', reason: 'Unknown reconnect token' });
    expect(localStorage.getItem('railyard.token')).toBeNull();
    expect(c.getState().rejection).toMatch(/game is no longer available/i);
  });

  it('keeps the last rejection until the next good message', () => {
    const c = new GameClient('ws://unused');
    c.receive({ type: 'rejected', code: 'colour-taken', reason: 'That colour is taken' });
    expect(c.getState().rejection).toBe('That colour is taken');
    c.receive({ type: 'lobby', code: 'X', hostId: 'p1', players: [] });
    expect(c.getState().rejection).toBeUndefined();
  });
});
