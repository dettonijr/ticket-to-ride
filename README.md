# Railyard

Online Ticket to Ride for two to five friends. One person creates a game and shares a code; everyone else joins from a browser. The official 2015 USA rules run on the server.

Design notes live in `docs/architecture.md`, the vocabulary in `GLOSSARY.md`, and the decisions in `docs/adr/`.

## Layout

| Package             | What it is                                                           |
| ------------------- | -------------------------------------------------------------------- |
| `packages/protocol` | Message types shared by server and client, plus the pure parser.     |
| `packages/engine`   | Pure, seeded, replayable rules. No I/O. Used by server and client.   |
| `packages/server`   | Node process: WebSocket gateway, in-memory rooms, serves the client. |
| `packages/client`   | React app: lobby, SVG board, hand and ticket panels.                 |

## Development

Requires Node 22 and pnpm 10.

```sh
pnpm install
pnpm dev        # server on :3000 with reload, client on :5173 proxying /ws to it
```

Checks:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

## Production

One Node process serves the built client and the WebSocket on a single port. There is no database: games live in the server's memory and are gone when it restarts.

Without Docker:

```sh
pnpm install
pnpm build      # client to packages/client/dist, server to packages/server/dist
pnpm start      # serves both on PORT (default 3000)
```

With Docker:

```sh
docker build -t railyard .
docker run --rm -p 3000:3000 railyard
```

Configuration is by environment variable:

| Variable     | Default                | Meaning                                  |
| ------------ | ---------------------- | ---------------------------------------- |
| `PORT`       | `3000`                 | Port for both the page and the WebSocket |
| `HOST`       | `0.0.0.0`              | Interface to listen on                   |
| `STATIC_DIR` | `packages/client/dist` | Directory of built client assets         |

To play with friends, run it on any host with one open port (a small VPS, a home machine with a tunnel, a container platform) and send them the URL. The client connects back to the same origin it was loaded from, so no client-side configuration is needed; put it behind HTTPS if the host is public.

`/healthz` answers `{"ok":true}` for load balancers and uptime checks.
