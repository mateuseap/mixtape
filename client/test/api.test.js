import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTracks, login } from '../src/api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('resolves with parsed JSON on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{ id: '1' }] }));
    const tracks = await fetchTracks();
    expect(tracks).toEqual([{ id: '1' }]);
  });

  it('throws the server error message on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'invalid password' }) }));
    await expect(login('wrong')).rejects.toThrow('invalid password');
  });
});
