import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './index';

describe('parseClientMessage', () => {
  it('accepts the known message shapes', () => {
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ type: 'ping' });
    expect(
      parseClientMessage('{"type":"join","code":"ABCDEF","name":"Ann","colour":"blue"}'),
    ).toEqual({ type: 'join', code: 'ABCDEF', name: 'Ann', colour: 'blue' });
  });

  it('accepts well-formed actions and refuses the rest', () => {
    expect(
      parseClientMessage(
        '{"type":"action","action":{"type":"chooseInitialTickets","keep":["t1","t2"]}}',
      ),
    ).toEqual({ type: 'action', action: { type: 'chooseInitialTickets', keep: ['t1', 't2'] } });
    expect(
      parseClientMessage('{"type":"action","action":{"type":"drawFaceUp","index":2}}'),
    ).toEqual({
      type: 'action',
      action: { type: 'drawFaceUp', index: 2 },
    });
    expect(parseClientMessage('{"type":"action","action":{"type":"drawFaceUp"}}')).toBeUndefined();
    expect(parseClientMessage('{"type":"action","action":{"type":"teleport"}}')).toBeUndefined();
    expect(parseClientMessage('{"type":"action"}')).toBeUndefined();
  });

  it('refuses malformed input', () => {
    expect(parseClientMessage('not json')).toBeUndefined();
    expect(parseClientMessage('{"type":"join"}')).toBeUndefined();
    expect(parseClientMessage('{"type":"launch"}')).toBeUndefined();
  });
});
