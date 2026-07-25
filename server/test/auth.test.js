import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken } from '../src/auth.js';

describe('session tokens', () => {
  it('verifies a token signed with the same secret', () => {
    const token = createSessionToken('secret-a');
    expect(verifySessionToken(token, 'secret-a')).toBe(true);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken('secret-a');
    expect(verifySessionToken(token, 'secret-b')).toBe(false);
  });

  it('rejects a malformed token', () => {
    expect(verifySessionToken('not-a-token', 'secret-a')).toBe(false);
    expect(verifySessionToken('', 'secret-a')).toBe(false);
    expect(verifySessionToken(undefined, 'secret-a')).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const token = createSessionToken('secret-a');
    const [, sig] = token.split('.');
    const tampered = `${Buffer.from(JSON.stringify({ iat: 0 })).toString('base64url')}.${sig}`;
    expect(verifySessionToken(tampered, 'secret-a')).toBe(false);
  });
});
