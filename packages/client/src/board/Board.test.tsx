import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ROUTE_BY_ID } from '@railyard/engine';
import { Board, routeGeometry } from './Board';

describe('Board', () => {
  it('draws all 36 cities and 100 routes', () => {
    const { container } = render(<Board claimed={{}} playerColours={{}} />);
    expect(container.querySelectorAll('.city')).toHaveLength(36);
    expect(container.querySelectorAll('.route')).toHaveLength(100);
  });

  it('paints a claimed route in its owner colour', () => {
    const { getByTestId } = render(
      <Board claimed={{ 'new-york-boston-1': 'p1' }} playerColours={{ p1: 'red' }} />,
    );
    const route = getByTestId('route-new-york-boston-1');
    expect(route.classList.contains('route-claimed')).toBe(true);
    expect(route.querySelectorAll('line')[1]?.getAttribute('stroke')).toBe('#dc2626');
  });

  it('only fires clicks on claimable routes', () => {
    const onRouteClick = vi.fn();
    const { getByTestId } = render(
      <Board
        claimed={{}}
        playerColours={{}}
        claimable={new Set(['seattle-portland-1'])}
        onRouteClick={onRouteClick}
      />,
    );
    fireEvent.click(getByTestId('route-seattle-portland-1'));
    fireEvent.click(getByTestId('route-seattle-portland-2'));
    expect(onRouteClick).toHaveBeenCalledTimes(1);
    expect(onRouteClick).toHaveBeenCalledWith('seattle-portland-1');
  });

  it('offsets twin routes to opposite sides', () => {
    const a = routeGeometry(ROUTE_BY_ID.get('seattle-portland-1')!);
    const b = routeGeometry(ROUTE_BY_ID.get('seattle-portland-2')!);
    expect(a.x1).not.toBe(b.x1);
    expect(Math.abs(a.x1 - b.x1) + Math.abs(a.y1 - b.y1)).toBeGreaterThan(10);
  });
});
