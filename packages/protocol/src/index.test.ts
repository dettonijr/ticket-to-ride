import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './index';

describe('parseClientMessage', () => {
  it('accepts the known message shapes', () => {
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ type: 'ping' });
    expect(
      parseClientMessage('{"type":"join","code":"ABCDEF","name":"Ann","colour":"blue"}'),
    ).toEqual({ type: 'join', code: 'ABCDEF', name: 'Ann', colour: 'blue' });
  });

  it('refuses malformed input', () => {
    expect(parseClientMessage('not json')).toBeUndefined();
    expect(parseClientMessage('{"type":"join"}')).toBeUndefined();
    expect(parseClientMessage('{"type":"launch"}')).toBeUndefined();
  });
});
