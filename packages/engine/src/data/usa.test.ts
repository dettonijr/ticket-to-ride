import { describe, expect, it } from 'vitest';
import { CITIES, CITY_BY_ID, ROUTES, ROUTE_BY_ID, TICKETS } from './usa';

describe('USA map data', () => {
  it('has 36 cities with unique ids and positions inside the board', () => {
    expect(CITIES).toHaveLength(36);
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(36);
    for (const c of CITIES) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(1);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(1);
    }
  });

  it('has 100 routes: 7 of each colour and 44 grey', () => {
    expect(ROUTES).toHaveLength(100);
    const counts: Record<string, number> = {};
    for (const r of ROUTES) counts[r.colour] = (counts[r.colour] ?? 0) + 1;
    expect(counts).toEqual({
      purple: 7,
      blue: 7,
      orange: 7,
      white: 7,
      green: 7,
      yellow: 7,
      black: 7,
      red: 7,
      grey: 44,
    });
  });

  it('connects only known cities with lengths 1 to 6', () => {
    for (const r of ROUTES) {
      expect(CITY_BY_ID.has(r.from), r.id).toBe(true);
      expect(CITY_BY_ID.has(r.to), r.id).toBe(true);
      expect(r.length).toBeGreaterThanOrEqual(1);
      expect(r.length).toBeLessThanOrEqual(6);
    }
  });

  it('pairs every double route with its twin symmetrically', () => {
    const twins = ROUTES.filter((r) => r.twinId);
    expect(twins).toHaveLength(44);
    for (const r of twins) {
      const twin = ROUTE_BY_ID.get(r.twinId as string);
      expect(twin, r.id).toBeDefined();
      expect(twin?.twinId).toBe(r.id);
      expect(twin?.from).toBe(r.from);
      expect(twin?.to).toBe(r.to);
      expect(twin?.length).toBe(r.length);
    }
  });

  it('has 30 tickets between known cities with known values', () => {
    expect(TICKETS).toHaveLength(30);
    for (const t of TICKETS) {
      expect(CITY_BY_ID.has(t.from), t.id).toBe(true);
      expect(CITY_BY_ID.has(t.to), t.id).toBe(true);
    }
    const byCities = (a: string, b: string) =>
      TICKETS.find((t) => t.from === a && t.to === b)?.points;
    expect(byCities('seattle', 'new-york')).toBe(22);
    expect(byCities('denver', 'el-paso')).toBe(4);
    expect(byCities('los-angeles', 'new-york')).toBe(21);
  });
});
