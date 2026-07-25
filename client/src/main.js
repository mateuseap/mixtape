import './style.css';
import { login, logout, fetchTracks, uploadTrack, deleteTrack, streamUrl } from './api.js';
import { createPlayerState, currentTrack, play, pause, next, prev, cycleRepeat, toggleShuffle } from './player.js';

const app = document.getElementById('app');
const audio = new Audio();
let state = createPlayerState([]);

function renderLogin(error) {
  app.innerHTML = `
    <form id="login-form" class="login">
      <h1>mixtape</h1>
      <input id="password" type="password" placeholder="password" autofocus />
      <button type="submit">enter</button>
      ${error ? `<p class="error">${error}</p>` : ''}
    </form>
  `;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    try {
      await login(password);
      await loadLibrary();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function renderPlayer() {
  const track = currentTrack(state);
  app.innerHTML = `
    <div class="device">
      <div class="lcd">
        <p class="lcd-title">${track ? track.title : 'no track selected'}</p>
        <p class="lcd-artist">${track?.artist ?? ''}</p>
        <input id="seek" type="range" min="0" max="1" step="0.01" value="0" />
      </div>
      <div class="controls">
        <button id="prev" title="previous">back</button>
        <button id="play-pause">${state.isPlaying ? 'pause' : 'play'}</button>
        <button id="next" title="next">skip</button>
        <button id="shuffle" class="${state.shuffle ? 'active' : ''}" title="shuffle">shuffle</button>
        <button id="repeat" class="${state.repeat !== 'off' ? 'active' : ''}" title="repeat">${state.repeat === 'one' ? 'repeat one' : 'repeat'}</button>
      </div>
      <button id="logout">log out</button>
    </div>
    <section class="library">
      <form id="upload-form">
        <input id="file" type="file" accept="audio/mpeg,.mp3" />
        <button type="submit">upload</button>
      </form>
      <ul id="track-list"></ul>
    </section>
  `;
  renderTrackList();
  syncAudio();
  wirePlayerControls();
}

function renderTrackList() {
  const list = document.getElementById('track-list');
  list.innerHTML = state.tracks
    .map(
      (t, i) => `
      <li class="${currentTrack(state)?.id === t.id ? 'current' : ''}" data-index="${i}">
        <span class="track-title">${t.title}</span>
        <span class="track-artist">${t.artist ?? ''}</span>
        <button class="delete" data-id="${t.id}" aria-label="delete">remove</button>
      </li>
    `,
    )
    .join('');
  list.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.delete')) return;
      setState(play(state, Number(li.dataset.index)));
    });
  });
  list.querySelectorAll('.delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteTrack(btn.dataset.id);
      await loadLibrary();
    });
  });
}

function wirePlayerControls() {
  document.getElementById('play-pause').addEventListener('click', () => {
    setState(state.isPlaying ? pause(state) : play(state));
  });
  document.getElementById('prev').addEventListener('click', () => setState(prev(state)));
  document.getElementById('next').addEventListener('click', () => setState(next(state)));
  document.getElementById('shuffle').addEventListener('click', () => setState(toggleShuffle(state)));
  document.getElementById('repeat').addEventListener('click', () => setState(cycleRepeat(state)));
  document.getElementById('logout').addEventListener('click', async () => {
    await logout();
    audio.pause();
    renderLogin();
  });
  document.getElementById('seek').addEventListener('input', (e) => {
    if (audio.duration) audio.currentTime = Number(e.target.value) * audio.duration;
  });
  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('file').files[0];
    if (!file) return;
    await uploadTrack(file);
    await loadLibrary();
  });
}

function syncAudio() {
  const track = currentTrack(state);
  const targetSrc = track ? streamUrl(track.id) : '';
  if (targetSrc && !audio.src.endsWith(targetSrc)) {
    audio.src = targetSrc;
  }
  if (state.isPlaying) audio.play().catch(() => {});
  else audio.pause();
}

function setState(newState) {
  state = newState;
  renderPlayer();
}

audio.addEventListener('ended', () => setState(next(state)));
audio.addEventListener('timeupdate', () => {
  const seek = document.getElementById('seek');
  if (seek && audio.duration) seek.value = audio.currentTime / audio.duration;
});

async function loadLibrary() {
  try {
    const tracks = await fetchTracks();
    state = createPlayerState(tracks);
    renderPlayer();
  } catch {
    renderLogin();
  }
}

loadLibrary();
