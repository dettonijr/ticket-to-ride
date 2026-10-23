import {
  apply,
  claimOptions,
  createGame,
  legalActions,
  ROUTE_BY_ID,
  type PlayerView,
} from '@railyard/engine';
import type { ClientMessage, ServerMessage } from '@railyard/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { RoomManager } from './rooms';
import { createServer, type RailyardServer } from './server';

/**
 * A whole game played through the server by two scripted clients, with the
 * room's randomness pinned so the run is reproducible.
 */

const SEED = 4242;
let server: RailyardServer;
let rooms: RoomManager;
let port: number;

beforeAll(async () => {
  rooms = new RoomManager({ randomSeed: () => SEED, randomOrder: (items) => items.slice() });
  server = createServer({ staticDir: '/nonexistent', rooms });
  await new Promise<void>((done) => server.httpServer.listen(0, '127.0.0.1', done));
  const address = server.httpServer.address();
  if (typeof address !== 'object' || address === null) throw new Error('no address');
  port = address.port;
});

afterAll(async () => {
  await server.close();
});

class Client {
  view: PlayerView | undefined;
  private waiters: Array<(m: ServerMessage) => void> = [];
  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as ServerMessage;
      if (msg.type === 'snapshot') this.view = msg.view;
      if (msg.type === 'rejected') throw new Error(`rejected: ${msg.reason}`);
      for (const w of this.waiters.splice(0)) w(msg);
    });
  }
  static async connect(): Promise<Client> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((done) => ws.on('open', done));
    return new Client(ws);
  }
  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }
  next(): Promise<ServerMessage> {
    return new Promise((resolve) => this.waiters.push(resolve));
  }
  async nextSnapshot(): Promise<PlayerView> {
    for (;;) {
      const m = await this.next();
      if (m.type === 'snapshot') return m.view;
    }
  }
  close(): void {
    this.ws.close();
  }
}

/** A simple but complete policy: claim the longest route you can, otherwise draw. */
function chooseAction(view: PlayerView): ClientMessage {
  const legal = legalActions(view);
  const claim = legal.find((a) => a.type === 'claimRoute');
  if (claim && claim.type === 'claimRoute' && claim.routes.length > 0) {
    const routeId = claim.routes
      .slice()
      .sort((a, b) => ROUTE_BY_ID.get(b)!.length - ROUTE_BY_ID.get(a)!.length)[0]!;
    const cards = claimOptions(view.me.hand, ROUTE_BY_ID.get(routeId)!)[0]!;
    return { type: 'action', action: { type: 'claimRoute', routeId, cards } };
  }
  const faceUp = legal.find((a) => a.type === 'drawFaceUp');
  if (faceUp && faceUp.type === 'drawFaceUp') {
    const colourIndex = faceUp.indexes.find((i) => view.faceUp[i] !== 'locomotive');
    return {
      type: 'action',
      action: { type: 'drawFaceUp', index: colourIndex ?? faceUp.indexes[0]! },
    };
  }
  if (legal.some((a) => a.type === 'drawBlind'))
    return { type: 'action', action: { type: 'drawBlind' } };
  throw new Error(`no action available in phase ${view.phase}`);
}

describe('a full game through the server', () => {
  it('plays to the end and both players receive the same final scores', async () => {
    const ann = await Client.connect();
    const bob = await Client.connect();
    const joined = ann.next();
    ann.send({ type: 'create', name: 'Ann', colour: 'blue' });
    const joinedMsg = await joined;
    if (joinedMsg.type !== 'joined') throw new Error(`expected joined, got ${joinedMsg.type}`);
    const code = joinedMsg.code;
    const bobJoined = bob.next();
    bob.send({ type: 'join', code, name: 'Bob', colour: 'red' });
    await bobJoined;

    const dealt = Promise.all([ann.nextSnapshot(), bob.nextSnapshot()]);
    ann.send({ type: 'start' });
    await dealt;

    for (const c of [ann, bob]) {
      const seen = Promise.all([ann.nextSnapshot(), bob.nextSnapshot()]);
      c.send({
        type: 'action',
        action: { type: 'chooseInitialTickets', keep: c.view!.me.pendingTickets.map((t) => t.id) },
      });
      await seen;
    }
    expect(ann.view?.phase).toBe('turnStart');

    const clients: Record<string, Client> = { [ann.view!.me.id]: ann, [bob.view!.me.id]: bob };
    let turns = 0;
    while (ann.view!.phase !== 'finished') {
      if (++turns > 3000) throw new Error('the game did not finish');
      const mover = clients[ann.view!.currentPlayer]!;
      const seen = Promise.all([ann.nextSnapshot(), bob.nextSnapshot()]);
      mover.send(chooseAction(mover.view!));
      await seen;
    }

    const a = ann.view!;
    const b = bob.view!;
    expect(b.phase).toBe('finished');
    expect(a.result).toBeDefined();
    expect(a.result).toEqual(b.result);
    for (const p of a.result!.players) {
      expect(p.total).toBe(p.routePoints + p.ticketPoints + (p.longestPathBonus ? 10 : 0));
      const pub = a.players.find((x) => x.id === p.playerId)!;
      expect(p.routePoints).toBe(pub.score);
      expect(pub.trainsLeft).toBeLessThanOrEqual(2 + 6);
    }
    expect(a.result!.players.some((p) => p.longestPathBonus)).toBe(true);
    const totals = a.result!.ranking.map(
      (id) => a.result!.players.find((p) => p.playerId === id)!.total,
    );
    expect(totals).toEqual(totals.slice().sort((x, y) => y - x));
    // Both players' tickets are revealed to both.
    expect(JSON.stringify(a.result)).toContain(b.me.tickets[0]!.id);

    // The game is reproducible: replaying the room's log from the seed gives the same result.
    const room = rooms.get(code)!;
    let replay = createGame(
      room.seats.map((s) => ({ id: s.id, name: s.name, colour: s.colour })),
      SEED,
    );
    for (const entry of room.log) {
      const r = apply(replay, entry.playerId, entry.action);
      if (!r.ok) throw new Error(r.violation.message);
      replay = r.state;
    }
    expect(replay.phase).toBe('finished');
    expect(replay.result).toEqual(a.result);

    ann.close();
    bob.close();
  }, 60_000);
});
