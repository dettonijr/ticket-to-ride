# Railyard (repo: ticket-to-ride)

Online Ticket to Ride for friends. Read `GLOSSARY.md` for vocabulary, `docs/architecture.md` for the design, and `docs/adr/` for decisions before changing anything.

## Working in this repo

- pnpm workspace, Node 22. Root commands: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm dev`. Run `pnpm format` before committing.
- Four packages under `packages/`: `engine` (pure rules), `protocol` (message types shared by server and client), `server` (Node + ws), `client` (React + Vite). Dependency direction is strict: client and server import `@railyard/engine` and `@railyard/protocol`; protocol imports only the engine; the engine imports nothing.
- `packages/engine` must stay pure (ADR 0001): no `Math.random`, no `Date`, no timers, no I/O. All randomness goes through the seeded generator in the engine. Functions never mutate their inputs.
- Tests are Vitest, co-located as `*.test.ts(x)`. Engine tests drive `createGame`, `apply`, `legalActions` and `redact` only. Server tests open real WebSocket clients against an in-process server. Build features test-first.
- Strict TypeScript with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; `consistent-type-imports` is enforced by ESLint.
- Name things with the glossary: Route, Ticket, Train Card, Locomotive, Train, Claim, Face-up Cards, Final Round, Longest Path.

## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels are used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
