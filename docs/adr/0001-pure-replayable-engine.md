---
status: accepted
date: 2026-10-23
---

# The game engine is a pure, seeded, replayable state machine

The rules of the game live in one package, `engine`, exposed as `apply(state, action)` which returns a new state or a rule violation and never mutates its input. All randomness comes from a seed fixed at game creation, so a game is fully determined by its seed and its ordered list of accepted actions. We chose this over the simpler approach of a server that edits one game object in place because it makes every rule testable without a server or browser, lets the client reuse the same code to grey out illegal moves, and gives crash recovery, reproducible bug reports, and a rematch-from-log for free.

## Considered options

- **Mutable game object on the server.** Fewer lines at first, and what most hobby implementations do. Rejected: rules end up tangled with networking, replay is impossible, and switching later means rewriting the engine.
- **Pure engine, seeded RNG, action log.** Chosen.

## Consequences

- `engine` must not import anything with side effects: no timers, no `Math.random`, no network, no storage.
- Any change to shuffling or dealing changes how old action logs replay. Persisted logs, if we ever keep them, need an engine version alongside the seed.
- The server stays thin: validate who is acting, call `apply`, keep the result, redact, send.
