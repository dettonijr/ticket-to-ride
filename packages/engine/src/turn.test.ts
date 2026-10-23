import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import type { GameState } from './state';
import { endTurn } from './turn';

const players = [
  { id: 'a', name: 'Ann', colour: 'blue' as const },
  { id: 'b', name: 'Bob', colour: 'red' as const },
  { id: 'c', name: 'Cy', colour: 'green' as const },
];

function playing(): GameState {
  const g = createGame(players, 1);
  return {
    ...g,
    phase: 'turnStart',
    players: g.players.map((p) => ({ ...p, pendingTickets: [] })),
  };
}

function withTrains(state: GameState, id: string, trainsLeft: number): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, trainsLeft } : p)) };
}

const did = { playerId: 'a', description: 'did a thing' };

describe('endTurn', () => {
  it('passes play to the next player in turn order and wraps around', () => {
    let s = playing();
    s = endTurn(s, did);
    expect(s.currentPlayer).toBe('b');
    expect(s.phase).toBe('turnStart');
    s = endTurn({ ...s, currentPlayer: 'c' }, did);
    expect(s.currentPlayer).toBe('a');
  });

  it('records the last action', () => {
    expect(endTurn(playing(), did).lastAction).toEqual(did);
  });

  it('triggers the final round when the player ends with two or fewer trains', () => {
    const s = endTurn(withTrains(playing(), 'a', 2), did);
    expect(s.finalRoundTriggeredBy).toBe('a');
    expect(s.turnsRemaining).toBe(3);
    expect(s.phase).toBe('turnStart');
    expect(s.currentPlayer).toBe('b');
  });

  it('does not trigger at three trains', () => {
    const s = endTurn(withTrains(playing(), 'a', 3), did);
    expect(s.finalRoundTriggeredBy).toBeUndefined();
    expect(s.turnsRemaining).toBeUndefined();
  });

  it('gives every player one more turn, including the trigger, then finishes', () => {
    let s = endTurn(withTrains(playing(), 'a', 1), did); // a triggered, b to play
    s = endTurn(s, did); // b played
    expect(s.turnsRemaining).toBe(2);
    expect(s.currentPlayer).toBe('c');
    s = endTurn(s, did); // c played
    expect(s.turnsRemaining).toBe(1);
    expect(s.currentPlayer).toBe('a');
    s = endTurn(s, did); // a's last turn
    expect(s.turnsRemaining).toBe(0);
    expect(s.phase).toBe('finished');
  });

  it('does not re-trigger when another player also drops to two trains during the final round', () => {
    let s = endTurn(withTrains(playing(), 'a', 0), did);
    s = endTurn(withTrains(s, 'b', 1), did);
    expect(s.finalRoundTriggeredBy).toBe('a');
    expect(s.turnsRemaining).toBe(2);
  });

  it('never mutates its input', () => {
    const before = withTrains(playing(), 'a', 2);
    const snapshot = JSON.stringify(before);
    endTurn(before, did);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
