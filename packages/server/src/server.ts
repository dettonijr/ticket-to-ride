import { createReadStream, existsSync, statSync } from 'node:fs';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { ENGINE_NAME } from '@railyard/engine';
import { parseClientMessage, type ServerMessage } from '@railyard/protocol';
import { RoomError, RoomManager, type Outbox, type Room, type Seat } from './rooms';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface RailyardServer {
  httpServer: ReturnType<typeof createHttpServer>;
  wss: WebSocketServer;
  rooms: RoomManager;
  close(): Promise<void>;
}

export interface ServerOptions {
  /** Directory of built client assets. Defaults to the client's dist folder. */
  staticDir?: string;
  rooms?: RoomManager;
}

/** Where the built client lives when nothing says otherwise: packages/client/dist. */
export function defaultStaticDir(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  // Works both from src/ (tsx) and from dist/ (bundled): both sit one level under packages/server.
  return resolve(here, '..', '..', 'client', 'dist');
}

export interface ServerConfig {
  port: number;
  host: string;
  staticDir: string;
}

/** Runtime configuration from the environment: PORT, HOST and STATIC_DIR. */
export function serverConfigFromEnv(env: Record<string, string | undefined>): ServerConfig {
  const port = Number(env['PORT'] ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be a whole number between 0 and 65535, got "${env['PORT']}"`);
  }
  return {
    port,
    host: env['HOST'] ?? '0.0.0.0',
    staticDir: env['STATIC_DIR'] ? resolve(env['STATIC_DIR']) : defaultStaticDir(),
  };
}

function serveStatic(staticDir: string, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path: string;
  try {
    path = normalize(decodeURIComponent(url.pathname));
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (path === '/') path = '/index.html';
  let file = resolve(staticDir, `.${path}`);
  if (file !== staticDir && !file.startsWith(staticDir + sep)) {
    // Never serve anything outside the static directory.
    res.writeHead(400).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // Single-page app: unknown paths get the shell.
    file = join(staticDir, 'index.html');
  }
  if (!existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>Railyard</title><h1>Railyard</h1><p>Client not built yet.</p>');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

/** One connected browser: its socket and, once seated, its room and seat. */
class Connection implements Outbox {
  room: Room | undefined;
  seat: Seat | undefined;

  constructor(
    private readonly socket: WebSocket,
    private readonly rooms: RoomManager,
  ) {}

  send(message: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) this.socket.send(JSON.stringify(message));
  }

  handle(raw: string): void {
    const msg = parseClientMessage(raw);
    if (!msg) {
      this.send({ type: 'error', message: 'unknown message' });
      return;
    }
    try {
      switch (msg.type) {
        case 'ping':
          this.send({ type: 'pong' });
          return;
        case 'create':
          this.seatAt(this.rooms.create(msg.name, msg.colour, this));
          return;
        case 'join':
          this.seatAt(this.rooms.join(msg.code, msg.name, msg.colour, this));
          return;
        case 'reconnect':
          this.seatAt(this.rooms.reconnect(msg.token, this));
          return;
        case 'start':
          if (!this.room || !this.seat) throw new RoomError('Join a game first');
          this.rooms.start(this.room, this.seat.id);
          return;
        case 'action':
          if (!this.room || !this.seat) throw new RoomError('Join a game first');
          this.rooms.act(this.room, this.seat.id, msg.action);
          return;
      }
    } catch (err) {
      if (err instanceof RoomError) {
        this.send({ type: 'rejected', reason: err.message });
        return;
      }
      throw err;
    }
  }

  closed(): void {
    if (this.seat) this.rooms.disconnect(this.seat, this);
  }

  private seatAt(placed: { room: Room; seat: Seat }): void {
    if (this.seat && this.seat !== placed.seat) this.rooms.disconnect(this.seat, this);
    this.room = placed.room;
    this.seat = placed.seat;
  }
}

export function createServer(options: ServerOptions = {}): RailyardServer {
  const staticDir = options.staticDir ?? defaultStaticDir();
  const rooms = options.rooms ?? new RoomManager();

  const httpServer = createHttpServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, engine: ENGINE_NAME }));
      return;
    }
    serveStatic(staticDir, req, res);
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (socket: WebSocket) => {
    const connection = new Connection(socket, rooms);
    socket.on('message', (raw) => {
      try {
        connection.handle(String(raw));
      } catch (err) {
        console.error('unhandled error for message', err);
        connection.send({ type: 'error', message: 'server error' });
      }
    });
    socket.on('close', () => connection.closed());
  });

  return {
    httpServer,
    wss,
    rooms,
    close: () =>
      new Promise<void>((resolveClose) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => httpServer.close(() => resolveClose()));
      }),
  };
}
