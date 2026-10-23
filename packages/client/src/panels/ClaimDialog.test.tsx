import { fireEvent, render, screen } from '@testing-library/react';
import { ROUTE_BY_ID } from '@railyard/engine';
import { describe, expect, it, vi } from 'vitest';
import { ClaimDialog } from './ClaimDialog';

const grey = ROUTE_BY_ID.get('kansas-city-oklahoma-city-1')!; // grey, length 2

describe('ClaimDialog', () => {
  it('lists every way the hand can pay and sends the chosen one', () => {
    const onClaim = vi.fn();
    render(
      <ClaimDialog
        route={grey}
        hand={['green', 'green', 'blue', 'locomotive']}
        onClaim={onClaim}
        onCancel={() => {}}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Claim Kansas City to Oklahoma City' }),
    ).toBeVisible();
    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.parentElement?.textContent)).toEqual([
      '1 blue + 1 locomotive',
      '2 green',
      '1 green + 1 locomotive',
    ]);

    fireEvent.click(screen.getByLabelText('2 green'));
    fireEvent.click(screen.getByRole('button', { name: 'Claim route' }));
    expect(onClaim).toHaveBeenCalledWith(['green', 'green']);
  });

  it('can be cancelled', () => {
    const onCancel = vi.fn();
    render(
      <ClaimDialog route={grey} hand={['green', 'green']} onClaim={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
