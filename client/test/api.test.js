import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTracks, deleteTrack } from '../src/api.js';

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'track not found' }) }));
    await expect(deleteTrack('some-id')).rejects.toThrow('track not found');
  });
});
