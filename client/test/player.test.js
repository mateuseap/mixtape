import { describe, it, expect } from 'vitest';
import { createPlayerState, currentTrack, play, pause, next, prev, cycleRepeat, toggleShuffle } from '../src/player.js';

const tracks = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }, { id: '3', title: 'C' }];

describe('player state', () => {
  it('starts with nothing playing', () => {
    const state = createPlayerState(tracks);
    expect(currentTrack(state)).toBeNull();
    expect(state.isPlaying).toBe(false);
  });

  it('play sets the position and isPlaying', () => {
    const state = play(createPlayerState(tracks), 1);
    expect(currentTrack(state).id).toBe('2');
    expect(state.isPlaying).toBe(true);
  });

  it('pause keeps position but stops playback', () => {
    const state = pause(play(createPlayerState(tracks), 1));
    expect(state.isPlaying).toBe(false);
    expect(currentTrack(state).id).toBe('2');
  });

  it('next advances and stops at the end when repeat is off', () => {
    let state = play(createPlayerState(tracks), 2);
    state = next(state);
    expect(state.isPlaying).toBe(false);
    expect(currentTrack(state).id).toBe('3');
  });

  it('next wraps around when repeat is all', () => {
    let state = play(createPlayerState(tracks), 2);
    state = cycleRepeat(state); // off -> all
    state = next(state);
    expect(currentTrack(state).id).toBe('1');
    expect(state.isPlaying).toBe(true);
  });

  it('next replays the same track when repeat is one', () => {
    let state = play(createPlayerState(tracks), 1);
    state = cycleRepeat(state); // off -> all
    state = cycleRepeat(state); // all -> one
    state = next(state);
    expect(currentTrack(state).id).toBe('2');
    expect(state.isPlaying).toBe(true);
  });

  it('prev moves back and clamps at the first track', () => {
    let state = play(createPlayerState(tracks), 1);
    state = prev(state);
    expect(currentTrack(state).id).toBe('1');
    state = prev(state);
    expect(currentTrack(state).id).toBe('1');
  });

  it('shuffle reorders but keeps the currently playing track current', () => {
    const seeded = play(createPlayerState(tracks), 1);
    const state = toggleShuffle(seeded);
    expect(state.shuffle).toBe(true);
    expect(currentTrack(state).id).toBe('2');
    expect(state.order).toHaveLength(3);
  });
});
