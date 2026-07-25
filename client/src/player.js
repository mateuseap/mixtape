export function createPlayerState(tracks = []) {
  return {
    tracks,
    order: tracks.map((_, i) => i),
    position: -1,
    isPlaying: false,
    shuffle: false,
    repeat: 'off', // 'off' | 'all' | 'one'
  };
}

function shuffledOrder(length) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function currentTrack(state) {
  if (state.position < 0) return null;
  return state.tracks[state.order[state.position]] ?? null;
}

export function play(state, index = state.position) {
  if (state.tracks.length === 0) return state;
  const position = index < 0 ? 0 : index;
  return { ...state, position, isPlaying: true };
}

export function pause(state) {
  return { ...state, isPlaying: false };
}

export function toggleShuffle(state) {
  const shuffle = !state.shuffle;
  const order = shuffle ? shuffledOrder(state.tracks.length) : state.tracks.map((_, i) => i);
  const position = state.position < 0 ? -1 : order.indexOf(state.order[state.position]);
  return { ...state, shuffle, order, position };
}

export function cycleRepeat(state) {
  const nextRepeat = { off: 'all', all: 'one', one: 'off' }[state.repeat];
  return { ...state, repeat: nextRepeat };
}

export function next(state) {
  if (state.tracks.length === 0) return state;
  if (state.repeat === 'one') return { ...state, isPlaying: true };
  const atEnd = state.position >= state.order.length - 1;
  if (atEnd && state.repeat !== 'all') return { ...state, isPlaying: false };
  const position = atEnd ? 0 : state.position + 1;
  return { ...state, position, isPlaying: true };
}

export function prev(state) {
  if (state.tracks.length === 0) return state;
  const position = state.position <= 0 ? 0 : state.position - 1;
  return { ...state, position, isPlaying: true };
}
