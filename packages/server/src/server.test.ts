import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '@railyard/protocol';
import { createServer, type RailyardServer } from './server';

let server: RailyardServer;
let port: number;

beforeAll(async () => {
  server = createServer({ staticDir: '/nonexistent' });
  await new Promise<void>((done) => server.httpServer.listen(0, '127.0.0.1', done));
  const address = server.httpServer.address();
  if (typeof address !== 'object' || address === null) throw new Error('no address');
  port = address.port;
});

afterAll(async () => {
  await server.close();
});

/** A test client that records every message and can wait for one by type. */
class Client {
  readonly messages: ServerMessage[] = [];
  private waiters: Array<{ type: ServerMessage['type']; resolve: (m: ServerMessage) => void }> = [];
  private readonly ws: WebSocket;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as ServerMessage;
      this.messages.push(msg);
      this.waiters = this.waiters.filter((w) => {
        if (w.type !== msg.type) return true;
        w.resolve(msg);
        return false;
      });
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

  next<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve) => {
      this.waiters.push({ type, resolve: resolve as (m: ServerMessage) => void });
    });
  }

  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    return this.messages.filter((m) => m.type === type).at(-1) as never;
  }

  close(): void {
    this.ws.close();
  }
}

describe('server', () => {
  it('serves a Railyard page when the client is not built', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Railyard');
  });

  it('answers a ping over the WebSocket', async () => {
    const c = await Client.connect();
    const pong = c.next('pong');
    c.send({ type: 'ping' });
    expect(await pong).toEqual({ type: 'pong' });
    c.close();
  });

  it('lets two players create, join and start, each receiving only their own hand', async () => {
    const ann = await Client.connect();
    const bob = await Client.connect();

    const annJoined = ann.next('joined');
    ann.send({ type: 'create', name: 'Ann', colour: 'blue' });
    const { code, playerId: annId, token } = await annJoined;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(token.length).toBeGreaterThan(10);

    const bobJoined = bob.next('joined');
    const annSeesBob = ann.next('lobby');
    bob.send({ type: 'join', code, name: 'Bob', colour: 'red' });
    const { playerId: bobId } = await bobJoined;
    expect((await annSeesBob).players.map((p) => p.name)).toEqual(['Ann', 'Bob']);

    const annSnap = ann.next('snapshot');
    const bobSnap = bob.next('snapshot');
    ann.send({ type: 'start' });
    const [a, b] = await Promise.all([annSnap, bobSnap]);

    expect(a.view.me.id).toBe(annId);
    expect(b.view.me.id).toBe(bobId);
    expect(a.view.me.hand).toHaveLength(4);
    expect(a.view.me.pendingTickets).toHaveLength(3);
    expect(a.view.faceUp).toHaveLength(5);
    expect(a.view.players.map((p) => p.name).sort()).toEqual(['Ann', 'Bob']);
    expect(JSON.stringify(a)).not.toContain(JSON.stringify(b.view.me.hand));
    expect(JSON.stringify(b)).not.toContain(JSON.stringify(a.view.me.hand));
    for (const other of a.view.players) {
      expect(other).not.toHaveProperty('hand');
      expect(other).not.toHaveProperty('tickets');
    }

    ann.close();
    bob.close();
  });

  it('rejects bad joins and a non-host start with reasons', async () => {
    const ann = await Client.connect();
    const bob = await Client.connect();
    const annJoined = ann.next('joined');
    ann.send({ type: 'create', name: 'Ann', colour: 'green' });
    const { code } = await annJoined;

    const r1 = bob.next('rejected');
    bob.send({ type: 'join', code: 'ZZZZZZ', name: 'Bob', colour: 'red' });
    expect((await r1).reason).toBe('No game with that code');

    const r2 = bob.next('rejected');
    bob.send({ type: 'join', code, name: 'Bob', colour: 'green' });
    expect((await r2).reason).toBe('That colour is taken');

    const r3 = bob.next('rejected');
    bob.send({ type: 'join', code, name: 'ann', colour: 'red' });
    expect((await r3).reason).toBe('That nickname is taken');

    const joined = bob.next('joined');
    bob.send({ type: 'join', code, name: 'Bob', colour: 'red' });
    await joined;
    const r4 = bob.next('rejected');
    bob.send({ type: 'start' });
    expect((await r4).reason).toBe('Only the host can start the game');

    ann.close();
    bob.close();
  });

  it('reconnects with a token after the socket drops', async () => {
    const ann = await Client.connect();
    const bob = await Client.connect();
    const annJoined = ann.next('joined');
    ann.send({ type: 'create', name: 'Ann', colour: 'yellow' });
    const { code } = await annJoined;
    const bobJoined = bob.next('joined');
    bob.send({ type: 'join', code, name: 'Bob', colour: 'black' });
    const { token, playerId } = await bobJoined;
    const snap = bob.next('snapshot');
    ann.send({ type: 'start' });
    await snap;

    const annSeesDrop = ann.next('lobby');
    bob.close();
    expect((await annSeesDrop).players.find((p) => p.id === playerId)?.connected).toBe(false);

    const bob2 = await Client.connect();
    const again = bob2.next('snapshot');
    bob2.send({ type: 'reconnect', token });
    expect((await again).view.me.id).toBe(playerId);

    ann.close();
    bob2.close();
  });

  it('runs actions through the engine: ticket choices reach turnStart and bad ones are rejected', async () => {
    const ann = await Client.connect();
    const bob = await Client.connect();
    const annJoined = ann.next('joined');
    ann.send({ type: 'create', name: 'Ann', colour: 'blue' });
    const { code } = await annJoined;
    const bobJoined = bob.next('joined');
    bob.send({ type: 'join', code, name: 'Bob', colour: 'red' });
    await bobJoined;
    const annSnap = ann.next('snapshot');
    const bobSnap = bob.next('snapshot');
    ann.send({ type: 'start' });
    const [a0, b0] = await Promise.all([annSnap, bobSnap]);
    expect(a0.view.phase).toBe('setup');

    // Bob tries to keep only one ticket: rejected, and only Bob hears about it.
    const bobRejected = bob.next('rejected');
    bob.send({
      type: 'action',
      action: { type: 'chooseInitialTickets', keep: [b0.view.me.pendingTickets[0]!.id] },
    });
    expect((await bobRejected).reason).toBe('Keep at least 2 of your 3 tickets');
    expect(ann.messages.filter((m) => m.type === 'rejected')).toHaveLength(0);

    // Both choose properly; everyone sees the phase advance and nobody sees the other's tickets.
    const annSees = ann.next('snapshot');
    const bobSees = bob.next('snapshot');
    bob.send({
      type: 'action',
      action: {
        type: 'chooseInitialTickets',
        keep: b0.view.me.pendingTickets.slice(0, 2).map((t) => t.id),
      },
    });
    const [a1, b1] = await Promise.all([annSees, bobSees]);
    expect(a1.view.phase).toBe('setup');
    expect(a1.view.waitingOn).toEqual([a1.view.me.id]);
    expect(b1.view.me.tickets).toHaveLength(2);
    expect(JSON.stringify(a1.view)).not.toContain(b1.view.me.tickets[0]!.id);

    const annSees2 = ann.next('snapshot');
    const bobSees2 = bob.next('snapshot');
    ann.send({
      type: 'action',
      action: {
        type: 'chooseInitialTickets',
        keep: a0.view.me.pendingTickets.map((t) => t.id),
      },
    });
    const [a2, b2] = await Promise.all([annSees2, bobSees2]);
    expect(a2.view.phase).toBe('turnStart');
    expect(b2.view.phase).toBe('turnStart');
    expect(b2.view.lastAction).toEqual({
      playerId: a2.view.me.id,
      description: 'Ann kept 3 tickets',
    });
    expect(JSON.stringify(b2.view)).not.toContain(a2.view.me.tickets[0]!.id);
    expect(JSON.stringify(b2.view)).not.toContain(JSON.stringify(a2.view.me.hand));

    // An action before joining is refused.
    const stranger = await Client.connect();
    const refused = stranger.next('rejected');
    stranger.send({ type: 'action', action: { type: 'drawBlind' } });
    expect((await refused).reason).toBe('Join a game first');

    ann.close();
    bob.close();
    stranger.close();
  });

  it('lets the current player draw two cards and shows both players the new table', async () => {
    const ann = await Client.connect();
    const bob = await Client.connect();
    const annJoined = ann.next('joined');
    ann.send({ type: 'create', name: 'Ann', colour: 'blue' });
    const { code } = await annJoined;
    const bobJoined = bob.next('joined');
    bob.send({ type: 'join', code, name: 'Bob', colour: 'red' });
    await bobJoined;
    const annSnap = ann.next('snapshot');
    const bobSnap = bob.next('snapshot');
    ann.send({ type: 'start' });
    const [a0, b0] = await Promise.all([annSnap, bobSnap]);

    // Both keep all three tickets to reach turnStart.
    const started = Promise.all([ann.next('snapshot'), bob.next('snapshot')]);
    ann.send({
      type: 'action',
      action: { type: 'chooseInitialTickets', keep: a0.view.me.pendingTickets.map((t) => t.id) },
    });
    await started;
    const ready = Promise.all([ann.next('snapshot'), bob.next('snapshot')]);
    bob.send({
      type: 'action',
      action: { type: 'chooseInitialTickets', keep: b0.view.me.pendingTickets.map((t) => t.id) },
    });
    const [a1] = await ready;
    expect(a1.view.phase).toBe('turnStart');

    const clients = { [a0.view.me.id]: ann, [b0.view.me.id]: bob };
    const current = clients[a1.view.currentPlayer]!;
    const other = current === ann ? bob : ann;
    const handBefore = a1.view.players.find((p) => p.id === a1.view.currentPlayer)!.handSize;

    // First draw: a face-up card. Both see the replacement and the bigger hand.
    const afterOne = Promise.all([current.next('snapshot'), other.next('snapshot')]);
    current.send({ type: 'action', action: { type: 'drawFaceUp', index: 0 } });
    const [c1, o1] = await afterOne;
    expect(c1.view.phase).toBe('drewOne');
    expect(c1.view.me.hand).toHaveLength(handBefore + 1);
    expect(o1.view.faceUp).toHaveLength(5);
    expect(o1.view.players.find((p) => p.id === c1.view.me.id)!.handSize).toBe(handBefore + 1);

    // Second draw: from the deck. The turn passes.
    const afterTwo = Promise.all([current.next('snapshot'), other.next('snapshot')]);
    current.send({ type: 'action', action: { type: 'drawBlind' } });
    const [c2, o2] = await afterTwo;
    expect(c2.view.me.hand).toHaveLength(handBefore + 2);
    expect(c2.view.phase).toBe('turnStart');
    expect(c2.view.currentPlayer).toBe(o2.view.me.id);
    expect(o2.view.lastAction?.description).toMatch(/drew a card from the deck$/);

    // The player who is not current cannot draw.
    const refused = current.next('rejected');
    current.send({ type: 'action', action: { type: 'drawBlind' } });
    expect((await refused).reason).toBe('It is not your turn');

    ann.close();
    bob.close();
  });

  it('lets the current player draw tickets and keep one; others see the count, never the ticket', async () => {
    const ann = await Client.connect();
    const bob = await Client.connect();
    const annJoined = ann.next('joined');
    ann.send({ type: 'create', name: 'Ann', colour: 'blue' });
    const { code } = await annJoined;
    const bobJoined = bob.next('joined');
    bob.send({ type: 'join', code, name: 'Bob', colour: 'red' });
    await bobJoined;
    const annSnap = ann.next('snapshot');
    const bobSnap = bob.next('snapshot');
    ann.send({ type: 'start' });
    const [a0, b0] = await Promise.all([annSnap, bobSnap]);

    // Everyone keeps all three initial tickets.
    for (const [c, snap] of [
      [ann, a0],
      [bob, b0],
    ] as const) {
      const seen = Promise.all([ann.next('snapshot'), bob.next('snapshot')]);
      c.send({
        type: 'action',
        action: {
          type: 'chooseInitialTickets',
          keep: snap.view.me.pendingTickets.map((t) => t.id),
        },
      });
      await seen;
    }
    const started = ann.last('snapshot')!.view;
    expect(started.phase).toBe('turnStart');
    const current = started.currentPlayer === a0.view.me.id ? ann : bob;
    const other = current === ann ? bob : ann;

    const drawnByCurrent = current.next('snapshot');
    const drawnSeenByOther = other.next('snapshot');
    current.send({ type: 'action', action: { type: 'drawTickets' } });
    const [c1, o1] = await Promise.all([drawnByCurrent, drawnSeenByOther]);
    expect(c1.view.phase).toBe('choosingTickets');
    expect(c1.view.me.pendingTickets).toHaveLength(3);
    expect(o1.view.me.pendingTickets).toHaveLength(0);
    for (const t of c1.view.me.pendingTickets) {
      expect(JSON.stringify(o1.view)).not.toContain(t.id);
    }

    const keptId = c1.view.me.pendingTickets[1]!.id;
    const chosenByCurrent = current.next('snapshot');
    const chosenSeenByOther = other.next('snapshot');
    current.send({ type: 'action', action: { type: 'chooseTickets', keep: [keptId] } });
    const [c2, o2] = await Promise.all([chosenByCurrent, chosenSeenByOther]);
    expect(c2.view.phase).toBe('turnStart');
    expect(c2.view.currentPlayer).toBe(o2.view.me.id);
    expect(c2.view.me.tickets).toHaveLength(4);
    const me = o2.view.players.find((p) => p.id === c2.view.me.id)!;
    expect(me.ticketCount).toBe(4);
    expect(JSON.stringify(o2.view)).not.toContain(keptId);
    expect(o2.view.lastAction?.description).toMatch(/drew tickets and kept 1$/);

    ann.close();
    bob.close();
  });
});
