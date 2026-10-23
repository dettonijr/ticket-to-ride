import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tickets } from './Tickets';

const tickets = [
  { id: 'van-sea', from: 'vancouver', to: 'seattle', points: 3 },
  { id: 'la-ny', from: 'los-angeles', to: 'new-york', points: 21 },
];

describe('Tickets', () => {
  it('marks a ticket completed when the viewer’s own routes join its cities', () => {
    render(
      <Tickets
        tickets={tickets}
        claimed={{ 'vancouver-seattle-1': 'me', 'los-angeles-el-paso-1': 'bob' }}
        playerId="me"
        canDraw={false}
        onDraw={() => {}}
      />,
    );
    expect(screen.getByRole('listitem', { name: /Vancouver to Seattle/ })).toHaveAttribute(
      'data-completed',
      'true',
    );
    expect(screen.getByRole('listitem', { name: /Los Angeles to New York/ })).toHaveAttribute(
      'data-completed',
      'false',
    );
  });

  it('offers a Draw tickets button only when legal', () => {
    const onDraw = vi.fn();
    const { rerender } = render(
      <Tickets tickets={tickets} claimed={{}} playerId="me" canDraw={false} onDraw={onDraw} />,
    );
    expect(screen.getByRole('button', { name: /draw tickets/i })).toBeDisabled();
    rerender(<Tickets tickets={tickets} claimed={{}} playerId="me" canDraw onDraw={onDraw} />);
    fireEvent.click(screen.getByRole('button', { name: /draw tickets/i }));
    expect(onDraw).toHaveBeenCalledTimes(1);
  });
});
