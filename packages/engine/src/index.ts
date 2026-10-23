/**
 * Railyard engine: the rules of the game as pure functions.
 *
 * Nothing in this package may import anything with side effects: no timers,
 * no Math.random, no network, no storage. See docs/adr/0001.
 */

export const ENGINE_NAME = 'railyard-engine';

export * from './state';
export * from './actions';
export * from './rng';
export * from './setup';
export * from './view';
export * from './turn';
export * from './rules/claimRoute';
export * from './apply';
export * from './legal';
export * from './data/usa';
