import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Table } from './Table';

const faceUp = ['blue', 'locomotive', 'green', 'yellow', 'black'] as const;

describe('Table', () => {
  it('offers every face-up card and the deck on the first draw', () => {
    const onDrawFaceUp = vi.fn();
    const onDrawBlind = vi.fn();
    render(
      <Table
        faceUp={faceUp}
        trainDeckSize={40}
        discardSize={0}
        ticketDeckSize={24}
        faceUpIndexes={[0, 1, 2, 3, 4]}
        canDrawBlind
        onDrawFaceUp={onDrawFaceUp}
        onDrawBlind={onDrawBlind}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'face-up locomotive' }));
    expect(onDrawFaceUp).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: /^train deck/ }));
    expect(onDrawBlind).toHaveBeenCalled();
  });

  it('greys out a face-up locomotive during the second draw', () => {
    render(
      <Table
        faceUp={faceUp}
        trainDeckSize={40}
        discardSize={0}
        ticketDeckSize={24}
        faceUpIndexes={[0, 2, 3, 4]}
        canDrawBlind
        onDrawFaceUp={() => {}}
        onDrawBlind={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'face-up locomotive' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'face-up blue' })).toBeEnabled();
  });

  it('disables the deck when the supply is empty', () => {
    render(
      <Table
        faceUp={faceUp}
        trainDeckSize={0}
        discardSize={0}
        ticketDeckSize={24}
        faceUpIndexes={[0, 2, 3, 4]}
        canDrawBlind={false}
        onDrawFaceUp={() => {}}
        onDrawBlind={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /^train deck/ })).toBeDisabled();
  });
});
