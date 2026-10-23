import { describe, expect, it } from 'vitest';
import { connectedCities, isTicketCompleted } from './connectivity';
import type { Ticket } from './state';

const t = (from: string, to: string): Ticket => ({ id: `${from}-${to}`, from, to, points: 1 });

describe('connectivity', () => {
  it('joins two cities with a direct route', () => {
    const claimed = { 'vancouver-seattle-1': 'ann' };
    expect(isTicketCompleted(claimed, 'ann', t('vancouver', 'seattle'))).toBe(true);
    expect(isTicketCompleted(claimed, 'ann', t('seattle', 'vancouver'))).toBe(true);
  });

  it('joins cities over a multi-hop path', () => {
    const claimed = {
      'vancouver-seattle-1': 'ann',
      'seattle-portland-1': 'ann',
      'portland-salt-lake-city-1': 'ann',
    };
    expect(isTicketCompleted(claimed, 'ann', t('vancouver', 'salt-lake-city'))).toBe(true);
  });

  it('does not count another player’s route as part of the path', () => {
    const claimed = {
      'vancouver-seattle-1': 'ann',
      'seattle-portland-1': 'bob',
      'portland-salt-lake-city-1': 'ann',
    };
    expect(isTicketCompleted(claimed, 'ann', t('vancouver', 'salt-lake-city'))).toBe(false);
  });

  it('reports no path when the cities are not joined', () => {
    expect(isTicketCompleted({}, 'ann', t('vancouver', 'seattle'))).toBe(false);
    expect(connectedCities({ 'vancouver-seattle-1': 'ann' }, 'ann')('vancouver', 'miami')).toBe(
      false,
    );
  });
});
