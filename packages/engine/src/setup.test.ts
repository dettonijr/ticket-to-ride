import { describe, expect, it } from 'vitest';
import { createGame, refillFaceUp, TOTAL_TRAIN_CARDS, type PlayerSeat } from './setup';
import { seedRng } from './rng';
import type { Card } from './state';

const seats: PlayerSeat[] = [
  { id: 'p1', name: 'Ann', colour: 'blue' },
  { id: 'p2', name: 'Bob', colour: 'red' },
  { id: 'p3', name: 'Cat', colour: 'green' },
];

describe('createGame', () => {
  it('deals 4 cards, 3 pending tickets and 45 trains to each player', () => {
    const game = createGame(seats, 1);
    expect(game.phase).toBe('setup');
    expect(game.players).toHaveLength(3);
    for (const p of game.players) {
      expect(p.hand).toHaveLength(4);
      expect(p.pendingTickets).toHaveLength(3);
      expect(p.tickets).toHaveLength(0);
      expect(p.trainsLeft).toBe(45);
      expect(p.score).toBe(0);
    }
  });

  it('turns five cards face up and keeps every card accounted for', () => {
    const game = createGame(seats, 1);
    expect(game.faceUp).toHaveLength(5);
    const inHands = game.players.reduce((n, p) => n + p.hand.length, 0);
    expect(inHands + game.faceUp.length + game.trainDeck.length + game.discard.length).toBe(
      TOTAL_TRAIN_CARDS,
    );
    const pending = game.players.reduce((n, p) => n + p.pendingTickets.length, 0);
    expect(pending + game.ticketDeck.length).toBe(30);
  });

  it('never starts with three or more face-up locomotives', () => {
    for (let seed = 0; seed < 300; seed++) {
      const game = createGame(seats, seed);
      const locomotives = game.faceUp.filter((c) => c === 'locomotive').length;
      expect(locomotives, `seed ${seed}`).toBeLessThan(3);
    }
  });

  it('keeps the given turn order and starts with the first seat', () => {
    const game = createGame(seats, 5);
    expect(game.turnOrder).toEqual(['p1', 'p2', 'p3']);
    expect(game.currentPlayer).toBe('p1');
  });

  it('is deterministic for a seed and differs between seeds', () => {
    expect(createGame(seats, 123)).toEqual(createGame(seats, 123));
    expect(createGame(seats, 123)).not.toEqual(createGame(seats, 124));
  });

  it('rejects fewer than 2 or more than 5 players', () => {
    expect(() => createGame(seats.slice(0, 1), 1)).toThrow();
    const six = [...seats, ...seats].map((s, i) => ({ ...s, id: `x${i}` }));
    expect(() => createGame(six, 1)).toThrow();
  });
});

describe('refillFaceUp', () => {
  it('discards the row and redeals when three locomotives show', () => {
    const deck: Card[] = [
      'locomotive',
      'locomotive',
      'locomotive',
      'red',
      'blue',
      'green',
      'white',
      'black',
      'orange',
      'purple',
    ];
    const result = refillFaceUp([], deck, [], seedRng(1));
    expect(result.faceUp).toHaveLength(5);
    expect(result.faceUp.filter((c) => c === 'locomotive').length).toBeLessThan(3);
    expect(result.discard.filter((c) => c === 'locomotive')).toHaveLength(3);
  });

  it('reshuffles the discards when the deck runs out', () => {
    const result = refillFaceUp(['red'], [], ['blue', 'green', 'white', 'black'], seedRng(1));
    expect(result.faceUp).toHaveLength(5);
    expect(result.discard).toHaveLength(0);
    expect(result.trainDeck).toHaveLength(0);
  });

  it('terminates with a row standing when the whole supply is locomotives', () => {
    const supply: Card[] = Array<Card>(8).fill('locomotive');
    const result = refillFaceUp([], supply, [], seedRng(1));
    expect(result.faceUp).toHaveLength(5);
    expect(result.faceUp.every((c) => c === 'locomotive')).toBe(true);
    expect(result.faceUp.length + result.trainDeck.length + result.discard.length).toBe(8);
  });
});
