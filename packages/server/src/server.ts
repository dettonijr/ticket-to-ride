import { createReadStream, existsSync, statSync } from 'node:fs';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { ENGINE_NAME } from '@railyard/engine';

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
  close(): Promise<void>;
}

export interface ServerOptions {
  /** Directory of built client assets. Defaults to the client's dist folder. */
  staticDir?: string;
}

function defaultStaticDir(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  // Works both from src/ (tsx) and from dist/ (bundled).
  return resolve(here, '..', '..', 'client', 'dist');
}

function serveStatic(staticDir: string, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = normalize(decodeURIComponent(url.pathname));
  if (path.includes('..')) {
    res.writeHead(400).end();
    return;
  }
  if (path === '/') path = '/index.html';
  let file = join(staticDir, path);
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

export function createServer(options: ServerOptions = {}): RailyardServer {
  const staticDir = options.staticDir ?? defaultStaticDir();

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
    socket.on('message', (raw) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'invalid JSON' }));
        return;
      }
      if (typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      socket.send(JSON.stringify({ type: 'error', message: 'unknown message' }));
    });
  });

  return {
    httpServer,
    wss,
    close: () =>
      new Promise<void>((resolveClose) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => httpServer.close(() => resolveClose()));
      }),
  };
}
