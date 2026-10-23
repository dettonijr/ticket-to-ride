import type { RuleViolation } from './actions';
import type { GameState } from './state';

/** An action that broke a rule. */
export type Refusal = { ok: false; violation: RuleViolation };

/** What `apply` and every rule return: the new game, or the rule that was broken. */
export type ApplyResult = { ok: true; state: GameState } | Refusal;

/** Refuse an action. `code` is stable for clients; `message` is for people. */
export function refuse(code: string, message: string): Refusal {
  return { ok: false, violation: { code, message } };
}
