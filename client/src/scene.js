import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  metalMaterial,
  createRenderer,
  addStandardLighting,
  makeGlyphTexture,
  drawTriangle,
  drawPlayPauseGlyph,
  createDragRotateController,
  startAnimationLoop,
} from './sceneCore.js';

const MARQUEE_SPEED = 46; // px/sec
const MARQUEE_GAP = 48; // px of blank space between loop repeats

const ACCENT_HEX = 0x0f7a63;
const DEFAULT_ROTATION_Y = 0.35;

function buildScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}

// The screen shows more than just the track: title/artist up top, a live
// oscilloscope-style waveform from the actual audio in the middle (flat
// when nothing is playing), and a segmented volume meter at the bottom,
// like the level displays real portable players had. Only the screen shows
// live state (play/pause status, the moving waveform) - the physical
// buttons print static icons, same as a real device.
function drawScreen(canvas, texture, { title, artist, volume, waveform, isPlaying, marqueeTime }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#0c1a14';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(143, 230, 196, 0.3)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.textBaseline = 'middle';

  // Play/pause status, top-right. This is the one place that state now
  // shows up, since the center button no longer swaps its icon.
  ctx.font = '700 16px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = isPlaying ? '#4dedb8' : 'rgba(143, 230, 196, 0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(isPlaying ? '▶ PLAYING' : '‖ PAUSED', w - 26, 30);
  ctx.textAlign = 'left';

  // Title marquee: rolls the full title across when it doesn't fit, so a
  // long name is eventually fully readable instead of getting cut off with
  // an ellipsis forever.
  const titleAreaX = 26;
  const titleAreaWidth = w - 52 - 130;
  const titleText = title || 'no track selected';
  ctx.font = '700 30px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = '#a8f5d6';
  const titleWidth = ctx.measureText(titleText).width;
  ctx.save();
  ctx.beginPath();
  ctx.rect(titleAreaX, 24, titleAreaWidth, 34);
  ctx.clip();
  if (titleWidth > titleAreaWidth) {
    const loopWidth = titleWidth + MARQUEE_GAP;
    const offset = ((marqueeTime ?? 0) * MARQUEE_SPEED) % loopWidth;
    let x = titleAreaX - offset;
    while (x < titleAreaX + titleAreaWidth) {
      ctx.fillText(titleText, x, 46);
      x += loopWidth;
    }
  } else {
    ctx.fillText(titleText, titleAreaX, 46);
  }
  ctx.restore();

  ctx.font = '500 20px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(168, 245, 214, 0.8)';
  ctx.fillText(truncate(ctx, artist || '', w - 60), 26, 80);

  // Waveform band.
  const waveTop = 96;
  const waveHeight = 96;
  const midY = waveTop + waveHeight / 2;
  ctx.strokeStyle = '#35d0a5';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const samples = waveform && waveform.length ? waveform : null;
  const barCount = 96;
  for (let i = 0; i < barCount; i++) {
    const x = 26 + (i / (barCount - 1)) * (w - 52);
    let amplitude = 0;
    if (samples) {
      const sample = samples[Math.floor((i / barCount) * samples.length)] / 128 - 1;
      amplitude = sample * (waveHeight / 2 - 4);
    }
    const y = midY + amplitude;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Volume meter.
  const meterY = h - 34;
  const meterSegments = 20;
  const meterWidth = w - 52;
  const segmentGap = 3;
  const segmentWidth = meterWidth / meterSegments - segmentGap;
  const filledSegments = Math.round((volume ?? 0) * meterSegments);
  for (let i = 0; i < meterSegments; i++) {
    const x = 26 + i * (segmentWidth + segmentGap);
    ctx.fillStyle = i < filledSegments ? '#35d0a5' : 'rgba(143, 230, 196, 0.18)';
    ctx.fillRect(x, meterY, segmentWidth, 12);
  }
  ctx.font = '400 16px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(143, 230, 196, 0.7)';
  ctx.textAlign = 'right';
  ctx.fillText(`VOL ${Math.round((volume ?? 0) * 100)}`, w - 26, meterY - 10);
  ctx.textAlign = 'left';

  texture.needsUpdate = true;
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}...`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

function drawPlus(ctx, s) {
  const bar = s * 0.16;
  ctx.fillRect(s * 0.5 - bar / 2, s * 0.18, bar, s * 0.64);
  ctx.fillRect(s * 0.18, s * 0.5 - bar / 2, s * 0.64, bar);
}

function drawMinus(ctx, s) {
  const bar = s * 0.16;
  ctx.fillRect(s * 0.18, s * 0.5 - bar / 2, s * 0.64, bar);
}

const GLYPH_TEXTURES = {
  playPause: makeGlyphTexture((ctx, s) => drawPlayPauseGlyph(ctx, s)),
  next: makeGlyphTexture((ctx, s) => {
    drawTriangle(ctx, s * 0.38, s / 2, s * 0.22, 0);
    drawTriangle(ctx, s * 0.68, s / 2, s * 0.22, 0);
  }),
  previous: makeGlyphTexture((ctx, s) => {
    drawTriangle(ctx, s * 0.32, s / 2, s * 0.22, 180);
    drawTriangle(ctx, s * 0.62, s / 2, s * 0.22, 180);
  }),
  // Filled +/- (not thin crossed strokes): a thin cross's vertical stroke
  // used to shear into illegible noise at the wheel's most foreshortened
  // zone before the z-offset fix below; filled shapes stayed legible
  // through that same investigation, so keep them filled going forward.
  volumeUp: makeGlyphTexture((ctx, s) => drawPlus(ctx, s), '#2b3230'),
  volumeDown: makeGlyphTexture((ctx, s) => drawMinus(ctx, s), '#2b3230'),
};

// Body is a portrait-oriented "candy bar" device: a screen sits in the top
// third with margin on every side, a click wheel sits in the bottom half
// with margin on every side, and there is deliberate clear space between
// the two so they never overlap. Each layer (body -> bezel -> screen, and
// body -> wheel ring -> center/notches) sits at a strictly increasing z so
// nothing is coplanar with anything else it doesn't fully contain (avoids
// z-fighting flicker).
const BODY_WIDTH = 1.4;
const BODY_HEIGHT = 2.15;
const BODY_DEPTH = 0.34;
const BODY_FRONT_Z = BODY_DEPTH / 2;

const SCREEN_WIDTH = 1.06;
const SCREEN_HEIGHT = 0.62;
const SCREEN_MARGIN_TOP = 0.14;
const SCREEN_CENTER_Y = BODY_HEIGHT / 2 - SCREEN_MARGIN_TOP - SCREEN_HEIGHT / 2;

const WHEEL_RADIUS = 0.5;
const WHEEL_MARGIN_BOTTOM = 0.14;
const WHEEL_CENTER_Y = -(BODY_HEIGHT / 2 - WHEEL_MARGIN_BOTTOM - WHEEL_RADIUS);
const CENTER_BUTTON_RADIUS = WHEEL_RADIUS * 0.38;

function buildDevice(screenTexture) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH, 6, 0.1),
    metalMaterial(0xdadedf, 0.85, 0.3),
  );
  group.add(body);

  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(SCREEN_WIDTH + 0.1, SCREEN_HEIGHT + 0.1, 0.02, 4, 0.03),
    metalMaterial(0x0a1210, 0.2, 0.2),
  );
  bezel.position.set(0, SCREEN_CENTER_Y, BODY_FRONT_Z + 0.006);
  group.add(bezel);

  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture });
  const screenGeometry = new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.set(0, SCREEN_CENTER_Y, BODY_FRONT_Z + 0.018);
  group.add(screen);

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, WHEEL_CENTER_Y, BODY_FRONT_Z);
  group.add(wheelGroup);

  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.03, 64),
    metalMaterial(0xc9cdce, 0.8, 0.28),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.01;
  ring.userData.interactive = 'wheel';
  wheelGroup.add(ring);

  const centerMaterial = new THREE.MeshStandardMaterial({
    color: ACCENT_HEX,
    metalness: 0.35,
    roughness: 0.3,
    emissive: ACCENT_HEX,
    emissiveIntensity: 0.15,
  });
  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(CENTER_BUTTON_RADIUS, CENTER_BUTTON_RADIUS, 0.04, 40),
    centerMaterial,
  );
  center.rotation.x = Math.PI / 2;
  center.position.z = 0.03;
  center.userData.interactive = 'center';
  wheelGroup.add(center);

  const centerHitArea = new THREE.Mesh(
    new THREE.CylinderGeometry(CENTER_BUTTON_RADIUS + 0.08, CENTER_BUTTON_RADIUS + 0.08, 0.05, 40),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  centerHitArea.rotation.x = Math.PI / 2;
  centerHitArea.position.z = 0.035;
  centerHitArea.userData.interactive = 'center';
  wheelGroup.add(centerHitArea);

  // Printed icons so each clickable zone shows what it does, like a real
  // click wheel: a static combined play/pause glyph on the center button
  // (real devices never swap the button's own icon, see setPlaying), and
  // volume/skip glyphs at the ring's four cardinal zones. These are
  // children of wheelGroup directly, not ring, so "up" is simply +Y with
  // no axis flip needed; a default PlaneGeometry already faces +Z toward
  // the camera.
  const GLYPH_SIZE = 0.23;
  const GLYPH_RADIUS = WHEEL_RADIUS * 0.72;
  // Well proud of the ring's own front face (~0.025): too close and the
  // two surfaces z-fight, which reads as illegible noise at grazing
  // viewing angles (worst at the top of the wheel, seen edge-on from this
  // camera). This is what actually broke the +/- glyphs before, not their
  // shape.
  const GLYPH_Z = 0.06;

  function addGlyph(texture, x, y) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GLYPH_SIZE, GLYPH_SIZE),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    mesh.position.set(x, y, GLYPH_Z);
    wheelGroup.add(mesh);
    return mesh;
  }

  addGlyph(GLYPH_TEXTURES.playPause, 0, 0);
  addGlyph(GLYPH_TEXTURES.volumeUp, 0, GLYPH_RADIUS);
  addGlyph(GLYPH_TEXTURES.volumeDown, 0, -GLYPH_RADIUS);
  addGlyph(GLYPH_TEXTURES.previous, -GLYPH_RADIUS, 0);
  addGlyph(GLYPH_TEXTURES.next, GLYPH_RADIUS, 0);

  const port = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.035, 0.03, 2, 0.012),
    metalMaterial(0x2b2f2f, 0.3, 0.6),
  );
  port.position.set(0, -BODY_HEIGHT / 2 + 0.04, BODY_FRONT_Z - 0.01);
  group.add(port);

  group.rotation.y = DEFAULT_ROTATION_Y;
  return { group, wheelGroup, ring, center, centerHitArea };
}

// Classifies a click on the ring into one of four zones by the angle of the
// hit point around the wheel's local center, matching a real click-wheel:
// top = volume up, bottom = volume down, left = previous, right = next.
//
// `localPoint` comes from `ring.worldToLocal()`, which undoes the ring's own
// `rotation.x = PI/2` along with everything else, so it lands back in the
// cylinder's raw geometry space, where the flat disc face lies in the local
// XZ plane (Y is the cylinder's height axis), not XY. Local +Z there maps to
// parent (screen) -Y, so "up" on screen is -localPoint.z, not localPoint.y.
function classifyRingZone(localPoint) {
  const angle = Math.atan2(-localPoint.z, localPoint.x);
  const deg = (angle * 180) / Math.PI;
  if (deg > -45 && deg <= 45) return 'next';
  if (deg > 45 && deg <= 135) return 'volume-up';
  if (deg > 135 || deg <= -135) return 'previous';
  return 'volume-down';
}

export function createDeviceScene(canvas, callbacks = {}, audioAnalyser = null) {
  const { onPlayPause, onPrev, onNext, onVolumeUp, onVolumeDown } = callbacks;

  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.1, 5.1);
  camera.lookAt(0, 0, 0);

  const pmremGenerator = addStandardLighting(scene, renderer);

  const screenTexture = buildScreenTexture();
  const { group: device, ring, center, centerHitArea } = buildDevice(screenTexture.texture);
  scene.add(device);

  let lastTitle = '';
  let lastArtist = '';
  let lastVolume = 1;
  drawScreen(screenTexture.canvas, screenTexture.texture, { title: '', artist: '', volume: lastVolume });

  const interactiveMeshes = [ring, centerHitArea, center];

  function triggerAction(hit) {
    const kind = hit.object.userData.interactive;
    if (kind === 'center') {
      audioAnalyser?.ensure();
      onPlayPause?.();
      return;
    }
    if (kind === 'wheel') {
      const local = ring.worldToLocal(hit.point.clone());
      const zone = classifyRingZone(local);
      if (zone === 'next') onNext?.();
      else if (zone === 'previous') onPrev?.();
      else if (zone === 'volume-up') onVolumeUp?.();
      else if (zone === 'volume-down') onVolumeDown?.();
    }
  }

  const controller = createDragRotateController({
    canvas,
    camera,
    deviceGroup: device,
    interactiveMeshes,
    defaultRotationY: DEFAULT_ROTATION_Y,
    onClick: triggerAction,
  });

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  let isPlaying = false;
  let screenRedrawAccum = 0;
  let marqueeTime = 0;
  const SCREEN_REDRAW_INTERVAL = 1 / 20; // the waveform doesn't need 60fps to read as live

  const stop = startAnimationLoop(renderer, scene, camera, controller, (delta) => {
    // Tracked every frame, independent of the redraw throttle below, so the
    // marquee's speed doesn't change if the redraw interval ever does.
    marqueeTime += delta;
    screenRedrawAccum += delta;
    if (screenRedrawAccum < SCREEN_REDRAW_INTERVAL) return;
    screenRedrawAccum = 0;
    const waveform = isPlaying ? audioAnalyser?.read() : null;
    drawScreen(screenTexture.canvas, screenTexture.texture, {
      title: lastTitle,
      artist: lastArtist,
      volume: lastVolume,
      waveform,
      isPlaying,
      marqueeTime,
    });
  });

  return {
    updateScreen(title, artist) {
      lastTitle = title;
      lastArtist = artist;
    },
    setVolume(volume) {
      lastVolume = volume;
    },
    setPlaying(playing) {
      isPlaying = playing;
    },
    resetRotation: controller.resetRotation,
    dispose() {
      stop();
      resizeObserver.disconnect();
      controller.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    },
  };
}
