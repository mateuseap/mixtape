// A MediaElementSourceNode can only ever be created once per <audio>
// element for the lifetime of the page - a second attempt throws. Scenes
// get disposed and recreated every time the user switches between the MP3
// and CD player (see main.js's switchDevice), so owning the analyser inside
// the scene closure meant switching devices and back permanently broke the
// waveform: the new scene's own attempt to wrap the same shared element
// threw, was swallowed, and the waveform stayed flat until a full page
// reload. Owning it here instead, independent of any scene's lifecycle,
// means it is only ever created once no matter how many times scenes come
// and go.
export function createAudioAnalyser(audioElement) {
  let audioContext = null;
  let analyser = null;
  let gainNode = null;
  let buffer = null;
  let currentVolume = 1;

  function ensure() {
    if (!audioElement) return;
    if (!audioContext) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextClass();
        const source = audioContext.createMediaElementSource(audioElement);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        buffer = new Uint8Array(analyser.frequencyBinCount);
        gainNode = audioContext.createGain();
        gainNode.gain.value = currentVolume;
        source.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioContext.destination);
      } catch {
        // Web Audio unavailable; the screen just shows a flat line, which is
        // a harmless visual degradation.
        return;
      }
    }
    // Browsers auto-suspend an AudioContext with no active output after a
    // period of silence, which pausing playback triggers - without this,
    // resuming playback later left the context stuck suspended and the
    // waveform permanently flat, even though the analyser itself was still
    // wired up correctly.
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  }

  function setVolume(value) {
    currentVolume = Math.min(1, Math.max(0, value));
    if (gainNode) {
      gainNode.gain.value = currentVolume;
    }
  }

  function read() {
    if (!analyser || !buffer) return null;
    analyser.getByteTimeDomainData(buffer);
    return buffer;
  }

  return { ensure, setVolume, read };
}
