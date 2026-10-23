import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from './index';

describe('engine package', () => {
  it('exports its name', () => {
    expect(ENGINE_NAME).toBe('railyard-engine');
  });
});
