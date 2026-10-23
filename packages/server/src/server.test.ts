import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
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

describe('server', () => {
  it('serves a Railyard page when the client is not built', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Railyard');
  });

  it('answers a ping over the WebSocket', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((done) => ws.on('open', done));
    const reply = new Promise<string>((done) => ws.once('message', (m) => done(String(m))));
    ws.send(JSON.stringify({ type: 'ping' }));
    expect(JSON.parse(await reply)).toEqual({ type: 'pong' });
    ws.close();
  });
});
