import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TicketChoice } from './TicketChoice';

const tickets = [
  { id: 'la-ny', from: 'los-angeles', to: 'new-york', points: 21 },
  { id: 'den-ep', from: 'denver', to: 'el-paso', points: 4 },
  { id: 'chi-sf', from: 'chicago', to: 'santa-fe', points: 9 },
];

describe('TicketChoice', () => {
  it('shows city names and points and disables Keep until the minimum is reached', () => {
    const onKeep = vi.fn();
    render(<TicketChoice tickets={tickets} minKeep={2} onKeep={onKeep} />);
    expect(screen.getByText('Los Angeles')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    const keep = screen.getByRole('button', { name: /keep/i });
    expect(keep).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Denver/));
    expect(keep).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Chicago/));
    expect(keep).toBeEnabled();

    fireEvent.click(keep);
    expect(onKeep).toHaveBeenCalledWith(['den-ep', 'chi-sf']);
  });

  it('lets the player keep everything', () => {
    const onKeep = vi.fn();
    render(<TicketChoice tickets={tickets} minKeep={2} onKeep={onKeep} />);
    for (const t of tickets)
      fireEvent.click(
        screen.getByLabelText(
          new RegExp(t.id === 'la-ny' ? 'Los Angeles' : t.id === 'den-ep' ? 'Denver' : 'Chicago'),
        ),
      );
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(onKeep).toHaveBeenCalledWith(['la-ny', 'den-ep', 'chi-sf']);
  });
});
