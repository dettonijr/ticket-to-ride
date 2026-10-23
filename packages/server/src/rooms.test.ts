import { describe, expect, it } from 'vitest';
import { RoomError, RoomManager, type Outbox } from './rooms';
import type { ServerMessage } from './protocol';

function inbox(): Outbox & {
  messages: ServerMessage[];
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined;
} {
  const messages: ServerMessage[] = [];
  return {
    messages,
    send: (m) => {
      messages.push(m);
    },
    last(type) {
      return messages.filter((m) => m.type === type).at(-1) as never;
    },
  };
}

function manager() {
  let n = 0;
  return new RoomManager({
    randomCode: () => `CODE${++n}`.padEnd(6, 'X'),
    randomSeed: () => 42,
    randomOrder: (items) => items.slice().reverse(),
  });
}

describe('RoomManager', () => {
  it('creates a room with the host seated and sends joined and lobby', () => {
    const rooms = manager();
    const ann = inbox();
    const { room, seat } = rooms.create('Ann', 'blue', ann);
    expect(room.code).toBe('CODE1X');
    expect(room.hostId).toBe(seat.id);
    expect(ann.last('joined')).toMatchObject({
      code: 'CODE1X',
      playerId: seat.id,
      hostId: seat.id,
    });
    expect(ann.last('joined')?.token).toHaveLength(24);
    expect(ann.last('lobby')?.players).toEqual([
      { id: seat.id, name: 'Ann', colour: 'blue', connected: true },
    ]);
  });

  it('lets a second player join and tells everyone', () => {
    const rooms = manager();
    const ann = inbox();
    const bob = inbox();
    rooms.create('Ann', 'blue', ann);
    rooms.join('code1x', 'Bob', 'red', bob);
    expect(ann.last('lobby')?.players.map((p) => p.name)).toEqual(['Ann', 'Bob']);
    expect(bob.last('lobby')?.players.map((p) => p.name)).toEqual(['Ann', 'Bob']);
  });

  it.each([
    [
      'unknown code',
      (r: RoomManager) => r.join('NOPE', 'Bob', 'red', inbox()),
      'No game with that code',
    ],
    [
      'taken colour',
      (r: RoomManager) => r.join('CODE1X', 'Bob', 'blue', inbox()),
      'That colour is taken',
    ],
    [
      'taken nickname',
      (r: RoomManager) => r.join('CODE1X', 'ann', 'red', inbox()),
      'That nickname is taken',
    ],
    [
      'empty nickname',
      (r: RoomManager) => r.join('CODE1X', '  ', 'red', inbox()),
      'Nickname must be 1 to 20 characters',
    ],
    [
      'bad colour',
      (r: RoomManager) => r.join('CODE1X', 'Bob', 'pink' as never, inbox()),
      'Pick one of the five train colours',
    ],
  ])('rejects a join with %s', (_label, attempt, reason) => {
    const rooms = manager();
    rooms.create('Ann', 'blue', inbox());
    expect(() => attempt(rooms)).toThrow(new RoomError(reason));
  });

  it('rejects a sixth player and a join after start', () => {
    const rooms = manager();
    const { room, seat } = rooms.create('Ann', 'blue', inbox());
    rooms.join('CODE1X', 'Bob', 'red', inbox());
    rooms.join('CODE1X', 'Cat', 'green', inbox());
    rooms.join('CODE1X', 'Dan', 'yellow', inbox());
    rooms.join('CODE1X', 'Eve', 'black', inbox());
    expect(() => rooms.join('CODE1X', 'Fay', 'black', inbox())).toThrow('That game is full');
    rooms.start(room, seat.id);
    expect(() => rooms.join('CODE1X', 'Fay', 'black', inbox())).toThrow(
      'That game has already started',
    );
  });

  it('only lets the host start, and only with two or more players', () => {
    const rooms = manager();
    const { room, seat: ann } = rooms.create('Ann', 'blue', inbox());
    expect(() => rooms.start(room, ann.id)).toThrow('Need at least 2 players to start');
    const { seat: bob } = rooms.join('CODE1X', 'Bob', 'red', inbox());
    expect(() => rooms.start(room, bob.id)).toThrow('Only the host can start the game');
  });

  it('starts a game with randomised order and sends each player their own snapshot', () => {
    const rooms = manager();
    const ann = inbox();
    const bob = inbox();
    const { room, seat: annSeat } = rooms.create('Ann', 'blue', ann);
    const { seat: bobSeat } = rooms.join('CODE1X', 'Bob', 'red', bob);
    rooms.start(room, annSeat.id);
    expect(room.status).toBe('playing');
    const annView = ann.last('snapshot')?.view;
    const bobView = bob.last('snapshot')?.view;
    expect(annView?.me.id).toBe(annSeat.id);
    expect(bobView?.me.id).toBe(bobSeat.id);
    // randomOrder reverses, so Bob goes first.
    expect(annView?.turnOrder).toEqual([bobSeat.id, annSeat.id]);
    expect(annView?.currentPlayer).toBe(bobSeat.id);
    expect(annView?.me.hand).toHaveLength(4);
    expect(bobView?.me.hand).toHaveLength(4);
    expect(annView?.me.hand).not.toEqual(bobView?.me.hand);
    expect(JSON.stringify(annView)).not.toContain(JSON.stringify(bobView?.me.hand));
  });

  it('reconnects by token and resends the snapshot', () => {
    const rooms = manager();
    const ann = inbox();
    const bob = inbox();
    const { room, seat: annSeat } = rooms.create('Ann', 'blue', ann);
    const { seat: bobSeat } = rooms.join('CODE1X', 'Bob', 'red', bob);
    rooms.start(room, annSeat.id);
    rooms.disconnect(bobSeat, bob);
    expect(ann.last('lobby')?.players.find((p) => p.id === bobSeat.id)?.connected).toBe(false);

    const bobAgain = inbox();
    const token = bob.last('joined')?.token as string;
    rooms.reconnect(token, bobAgain);
    expect(bobAgain.last('joined')?.playerId).toBe(bobSeat.id);
    expect(bobAgain.last('snapshot')?.view.me.id).toBe(bobSeat.id);
    expect(ann.last('lobby')?.players.find((p) => p.id === bobSeat.id)?.connected).toBe(true);
    expect(() => rooms.reconnect('bogus', inbox())).toThrow('Unknown reconnect token');
  });
});
