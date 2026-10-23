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

```sh
pnpm install
pnpm build      # client to packages/client/dist, server to packages/server/dist
pnpm start      # serves both on PORT (default 3000)
```
