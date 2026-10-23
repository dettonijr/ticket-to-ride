import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, defaultStaticDir, serverConfigFromEnv, type RailyardServer } from './server';

let dir: string;
let server: RailyardServer;
let base: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'railyard-static-'));
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><title>Railyard</title><div id="root"></div>',
  );
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("app")');
  writeFileSync(join(dir, 'assets', 'app.css'), 'body{margin:0}');

  server = createServer(serverConfigFromEnv({ STATIC_DIR: dir, PORT: '0' }));
  await new Promise<void>((done) => server.httpServer.listen(0, '127.0.0.1', done));
  const address = server.httpServer.address();
  if (typeof address !== 'object' || address === null) throw new Error('no address');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('serverConfigFromEnv', () => {
  it('defaults to port 3000 on all interfaces and the client dist folder', () => {
    const config = serverConfigFromEnv({});
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.staticDir).toBe(defaultStaticDir());
    expect(config.staticDir).toMatch(/packages[\\/]client[\\/]dist$/);
  });

  it('reads PORT, HOST and STATIC_DIR, resolving the directory to an absolute path', () => {
    const config = serverConfigFromEnv({ PORT: '8080', HOST: '127.0.0.1', STATIC_DIR: 'public' });
    expect(config).toEqual({ port: 8080, host: '127.0.0.1', staticDir: resolve('public') });
  });

  it('refuses a PORT that is not a port', () => {
    expect(() => serverConfigFromEnv({ PORT: 'eighty' })).toThrow(/PORT/);
  });
});

describe('static files from STATIC_DIR', () => {
  it('serves index.html at the root', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('id="root"');
  });

  it('serves assets with their media type', async () => {
    const js = await fetch(`${base}/assets/app.js`);
    expect(js.headers.get('content-type')).toContain('text/javascript');
    expect(await js.text()).toContain('console.log');
    const css = await fetch(`${base}/assets/app.css`);
    expect(css.headers.get('content-type')).toContain('text/css');
  });

  it('falls back to index.html for unknown paths so the app can own its routes', async () => {
    const res = await fetch(`${base}/game/ABCDEF`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('id="root"');
  });

  it('never serves a file outside the directory, however the path is written', async () => {
    const secret = `top-secret-${Date.now()}`;
    writeFileSync(join(dir, '..', 'railyard-secret.txt'), secret);
    try {
      for (const path of [
        '/../railyard-secret.txt',
        '/..%2Frailyard-secret.txt',
        '/assets/../../railyard-secret.txt',
        '/%2e%2e/railyard-secret.txt',
      ]) {
        const res = await fetch(`${base}${path}`);
        expect([200, 400]).toContain(res.status);
        expect(await res.text()).not.toContain(secret);
      }
    } finally {
      rmSync(join(dir, '..', 'railyard-secret.txt'), { force: true });
    }
  });

  it('answers 400 to a malformed percent-encoding instead of crashing', async () => {
    const res = await fetch(`${base}/%E0%A4%A`);
    expect(res.status).toBe(400);
  });

  it('keeps the health endpoint', async () => {
    const res = await fetch(`${base}/healthz`);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});
