import './style.css';
import { fetchTracks, uploadTrack, deleteTrack, streamUrl } from './api.js';
import { createPlayerState, currentTrack, play, pause, next, prev, cycleRepeat, toggleShuffle } from './player.js';
import { createDeviceScene } from './scene.js';

const audio = new Audio();
let state = createPlayerState([]);

const playerBar = document.getElementById('player-bar');
const trackRow = document.getElementById('track-row');
const shuffleToggle = document.getElementById('shuffle-toggle');
const repeatToggle = document.getElementById('repeat-toggle');
const resetViewBtn = document.getElementById('reset-view');
const addTrackBtn = document.getElementById('add-track-btn');
const fileInput = document.getElementById('file-input');
const scrollLeftBtn = document.getElementById('scroll-left');
const scrollRightBtn = document.getElementById('scroll-right');
const canvas = document.getElementById('device-canvas');

const VOLUME_STEP = 0.1;

const scene = createDeviceScene(canvas, {
  onPlayPause: () => setState(state.isPlaying ? pause(state) : play(state)),
  onPrev: () => setState(prev(state)),
  onNext: () => setState(next(state)),
  onVolumeUp: () => setVolume(audio.volume + VOLUME_STEP),
  onVolumeDown: () => setVolume(audio.volume - VOLUME_STEP),
});

function setVolume(value) {
  audio.volume = Math.min(1, Math.max(0, value));
  const slider = document.getElementById('pb-volume');
  if (slider) slider.value = audio.volume;
}

function hashHue(id) {
  const str = String(id ?? 'x');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function artStyle(id) {
  const hue = hashHue(id);
  return `background: linear-gradient(135deg, hsl(${hue}, 62%, 52%), hsl(${(hue + 40) % 360}, 55%, 38%));`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function renderPlayerBar() {
  const track = currentTrack(state);
  playerBar.innerHTML = `
    <div class="pb-art" style="${artStyle(track?.id)}">${track ? '&#9835;' : ''}</div>
    <div class="pb-meta">
      <span class="pb-title">${track ? escapeHtml(track.title) : 'No track selected'}</span>
      <span class="pb-artist">${track ? escapeHtml(track.artist ?? '') : ''}</span>
    </div>
    <div class="pb-controls">
      <button id="pb-prev" class="pb-btn" type="button" aria-label="Previous track">${iconPrev()}</button>
      <button id="pb-play" class="pb-btn pb-play" type="button" aria-label="${state.isPlaying ? 'Pause' : 'Play'}">${state.isPlaying ? iconPause() : iconPlay()}</button>
      <button id="pb-next" class="pb-btn" type="button" aria-label="Next track">${iconNext()}</button>
    </div>
    <span class="pb-time" id="pb-elapsed">0:00</span>
    <input id="pb-seek" class="pb-seek" type="range" min="0" max="1" step="0.001" value="0" aria-label="Seek" />
    <span class="pb-time" id="pb-total">0:00</span>
    <span class="pb-volume-icon">${iconVolume()}</span>
    <input id="pb-volume" class="pb-volume" type="range" min="0" max="1" step="0.01" value="${audio.volume}" aria-label="Volume" />
  `;
  wirePlayerBar();
}

function wirePlayerBar() {
  document.getElementById('pb-prev').addEventListener('click', () => setState(prev(state)));
  document.getElementById('pb-play').addEventListener('click', () => {
    setState(state.isPlaying ? pause(state) : play(state));
  });
  document.getElementById('pb-next').addEventListener('click', () => setState(next(state)));
  document.getElementById('pb-seek').addEventListener('input', (e) => {
    if (audio.duration) audio.currentTime = Number(e.target.value) * audio.duration;
  });
  document.getElementById('pb-volume').addEventListener('input', (e) => {
    setVolume(Number(e.target.value));
  });
}

function renderTrackRow() {
  if (state.tracks.length === 0) {
    trackRow.innerHTML = '<p class="library-empty">No tracks yet. Add an MP3 to get started.</p>';
    return;
  }
  trackRow.innerHTML = state.tracks
    .map((t, i) => {
      const isCurrent = currentTrack(state)?.id === t.id;
      return `
        <button class="track-card ${isCurrent ? 'current' : ''}" data-index="${i}" type="button">
          <span class="track-card-art" style="${artStyle(t.id)}">&#9835;</span>
          <span class="track-card-title">${escapeHtml(t.title)}</span>
          <span class="track-card-artist">${escapeHtml(t.artist ?? '')}</span>
          <span class="track-card-delete" data-id="${t.id}" role="button" tabindex="0" aria-label="Delete track">&times;</span>
        </button>
      `;
    })
    .join('');
  trackRow.querySelectorAll('.track-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.track-card-delete')) return;
      setState(play(state, Number(card.dataset.index)));
    });
  });
  trackRow.querySelectorAll('.track-card-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteTrack(btn.dataset.id);
      await loadLibrary();
    });
  });
}

const REPEAT_LABELS = {
  off: 'Repeat: off (click to repeat all)',
  all: 'Repeat: all tracks (click to repeat one)',
  one: 'Repeat: current track (click to turn off)',
};

function renderModeControls() {
  shuffleToggle.classList.toggle('active', state.shuffle);
  shuffleToggle.title = state.shuffle ? 'Shuffle: on (click to turn off)' : 'Shuffle: off (click to turn on)';

  repeatToggle.classList.toggle('active', state.repeat !== 'off');
  repeatToggle.classList.toggle('repeat-one', state.repeat === 'one');
  repeatToggle.title = REPEAT_LABELS[state.repeat];
}

function iconPlay() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
}
function iconPause() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
}
function iconPrev() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z"/></svg>';
}
function iconNext() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>';
}
function iconVolume() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9z"/></svg>';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function syncAudio() {
  const track = currentTrack(state);
  const targetSrc = track ? streamUrl(track.id) : '';
  if (targetSrc && !audio.src.endsWith(targetSrc)) {
    audio.src = targetSrc;
  }
  if (state.isPlaying) audio.play().catch(() => {});
  else audio.pause();
  scene.updateScreen(track ? track.title : '', track ? track.artist ?? '' : '');
}

function setState(newState) {
  state = newState;
  renderPlayerBar();
  renderTrackRow();
  renderModeControls();
  syncAudio();
}

audio.addEventListener('ended', () => setState(next(state)));
audio.addEventListener('timeupdate', () => {
  const seek = document.getElementById('pb-seek');
  const elapsed = document.getElementById('pb-elapsed');
  const total = document.getElementById('pb-total');
  if (seek && audio.duration) seek.value = audio.currentTime / audio.duration;
  if (elapsed) elapsed.textContent = formatTime(audio.currentTime);
  if (total) total.textContent = formatTime(audio.duration);
});
audio.addEventListener('loadedmetadata', () => {
  const total = document.getElementById('pb-total');
  if (total) total.textContent = formatTime(audio.duration);
});

shuffleToggle.addEventListener('click', () => setState(toggleShuffle(state)));
repeatToggle.addEventListener('click', () => setState(cycleRepeat(state)));
resetViewBtn.addEventListener('click', () => scene.resetRotation());
addTrackBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  await uploadTrack(file);
  fileInput.value = '';
  await loadLibrary();
});
scrollLeftBtn.addEventListener('click', () => {
  trackRow.scrollBy({ left: -320, behavior: 'smooth' });
});
scrollRightBtn.addEventListener('click', () => {
  trackRow.scrollBy({ left: 320, behavior: 'smooth' });
});

async function loadLibrary() {
  const tracks = await fetchTracks().catch(() => []);
  const wasPlayingId = currentTrack(state)?.id;
  state = createPlayerState(tracks);
  if (wasPlayingId) {
    const index = tracks.findIndex((t) => t.id === wasPlayingId);
    if (index >= 0) state = { ...state, position: index };
  }
  renderPlayerBar();
  renderTrackRow();
  renderModeControls();
  syncAudio();
}

loadLibrary();
