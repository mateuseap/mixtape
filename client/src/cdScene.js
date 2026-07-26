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

const DEFAULT_ROTATION_Y = 0.3;

const CHASSIS_WIDTH = 2.9;
// Taller than before: at the old 1.15 the closed lid's bottom edge (see
// lidHeight below) landed at y=-0.02, which is inside the LCD's own top
// edge (y=0.02) - the lid was physically overlapping the screen. Taller
// chassis buys enough vertical room to give the bay, lid, LCD, and buttons
// their own clear bands with margin between each.
const CHASSIS_HEIGHT = 1.5;
const CHASSIS_DEPTH = 0.8;
const FRONT_Z = CHASSIS_DEPTH / 2;

// Speaker radius was 0.44 at SPEAKER_X 0.98, so the outer edge (1.42) sat
// past the old chassis half-width (1.35) - the speaker was literally
// poking through the case. Shrinking the radius slightly and widening the
// chassis a touch fixes that, and also opens enough clearance in the
// center console (inner edge now 0.58) for the transport row below to sit
// fully clear of both speakers.
const SPEAKER_RADIUS = 0.4;
const SPEAKER_X = 0.98;

const BAY_RADIUS = 0.24;
const BAY_Y = 0.38;
// The chassis is a single solid box, not a shell with an actual cutout, so
// anything placed BEHIND its front face (z < FRONT_Z) is fully occluded by
// that opaque surface - not dim, not z-fighting, just invisible. That was
// the bug after the previous "fix": pushing the bay to FRONT_Z - 0.035 to
// stop it z-fighting against the chassis (both surfaces exactly coplanar
// at FRONT_Z) also hid it completely behind that same solid face. Every
// other front-mounted part (speakers at FRONT_Z + 0.02, buttons at
// FRONT_Z + 0.03) already sits PROUD of the chassis for this exact reason;
// the bay needs the same treatment; a comfortable margin (rather than a
// hair's width) keeps the whole cylinder, including its rim, clear of the
// chassis face so there is no coplanar surface left to fight over.
const BAY_Z = FRONT_Z + 0.02;

const LCD_Y = -0.04;
const LCD_WIDTH = 0.56;
const LCD_HEIGHT = 0.2;

const BUTTON_Y = -0.42;
const BUTTON_SIZE = 0.15;
// Six buttons on a fixed pitch, centered on x=0 - the whole row spans
// ±0.5, comfortably inside the 0.58 gap left by the speakers.
const BUTTON_PITCH = 0.17;

const DISC_SPIN_SPEED = 2.2; // radians/sec while playing, freezes otherwise

const LID_OPEN_DEG = -118;

function grilleTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d2422';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 2;
  const center = size / 2;
  for (let r = 14; r < center; r += 14) {
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildLcdTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 128;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
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

function buildDiscCoverTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}

// Cover art printed on the disc face, in the same hash-colored gradient
// style as the library's track cards (see hashHue/artStyle in main.js), so
// the loaded disc reads as "this track" rather than a generic blank disc.
// The off-center label is deliberate: a perfectly radially-symmetric
// texture would hide the fact the disc is spinning at all.
function drawDiscCover(canvas, texture, { title, trackId }) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  ctx.clearRect(0, 0, size, size);

  const hue = hashHue(trackId ?? title);
  const gradient = ctx.createRadialGradient(center, center, size * 0.08, center, center, size * 0.5);
  gradient.addColorStop(0, `hsl(${hue}, 60%, 55%)`);
  gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 55%, 30%)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let r = size * 0.16; r < size * 0.48; r += size * 0.045) {
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(-0.35);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = '700 20px "Geist Mono", ui-monospace, monospace';
  const label = (title || 'TRACK').slice(0, 14).toUpperCase();
  ctx.fillText(label, 0, -size * 0.22);
  ctx.restore();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.14, 0, Math.PI * 2);
  ctx.stroke();

  texture.needsUpdate = true;
}

function drawLcd(canvas, texture, { title, trackNumber, isPlaying, hasDisc }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0c1a14';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(143, 230, 196, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.fillStyle = '#8fe6c4';
  ctx.font = '600 26px "Geist Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  if (!hasDisc) {
    ctx.fillText('NO DISC', 20, h / 2);
  } else {
    ctx.fillText(`CD ${String(trackNumber).padStart(2, '0')} ${isPlaying ? '▶' : '‖'}`, 20, 38);
    ctx.font = '400 18px "Geist Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(143, 230, 196, 0.7)';
    const truncated = title && title.length > 22 ? `${title.slice(0, 22)}...` : title || '';
    ctx.fillText(truncated, 20, 78);
  }
  texture.needsUpdate = true;
}

const GLYPH_TEXTURES = {
  playPause: makeGlyphTexture((ctx, s) => drawPlayPauseGlyph(ctx, s), '#1d2422'),
  stop: makeGlyphTexture((ctx, s) => {
    const side = s * 0.4;
    ctx.fillRect(s / 2 - side / 2, s / 2 - side / 2, side, side);
  }, '#1d2422'),
  next: makeGlyphTexture((ctx, s) => {
    drawTriangle(ctx, s * 0.38, s / 2, s * 0.2, 0);
    drawTriangle(ctx, s * 0.68, s / 2, s * 0.2, 0);
  }, '#1d2422'),
  previous: makeGlyphTexture((ctx, s) => {
    drawTriangle(ctx, s * 0.32, s / 2, s * 0.2, 180);
    drawTriangle(ctx, s * 0.62, s / 2, s * 0.2, 180);
  }, '#1d2422'),
  volumeUp: makeGlyphTexture((ctx, s) => {
    const bar = s * 0.16;
    ctx.fillRect(s * 0.5 - bar / 2, s * 0.18, bar, s * 0.64);
    ctx.fillRect(s * 0.18, s * 0.5 - bar / 2, s * 0.64, bar);
  }, '#1d2422'),
  volumeDown: makeGlyphTexture((ctx, s) => {
    const bar = s * 0.16;
    ctx.fillRect(s * 0.18, s * 0.5 - bar / 2, s * 0.64, bar);
  }, '#1d2422'),
};

function addButton(parent, texture, x, y, action) {
  const button = new THREE.Mesh(
    new RoundedBoxGeometry(BUTTON_SIZE, BUTTON_SIZE, 0.05, 3, 0.03),
    metalMaterial(0xdadedf, 0.5, 0.45),
  );
  button.position.set(x, y, FRONT_Z + 0.03);
  button.userData.interactive = action;
  parent.add(button);

  const glyph = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_SIZE * 0.75, BUTTON_SIZE * 0.75),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  glyph.position.set(x, y, FRONT_Z + 0.061);
  parent.add(glyph);
  return { button, glyph };
}

function buildDevice(lcdTexture) {
  const group = new THREE.Group();

  const chassis = new THREE.Mesh(
    new RoundedBoxGeometry(CHASSIS_WIDTH, CHASSIS_HEIGHT, CHASSIS_DEPTH, 6, 0.08),
    metalMaterial(0xcfd3d2, 0.6, 0.4),
  );
  group.add(chassis);

  const grille = grilleTexture();
  for (const sign of [-1, 1]) {
    const speaker = new THREE.Mesh(
      new THREE.CylinderGeometry(SPEAKER_RADIUS, SPEAKER_RADIUS, 0.05, 48),
      new THREE.MeshStandardMaterial({ map: grille, metalness: 0.1, roughness: 0.8 }),
    );
    speaker.rotation.x = Math.PI / 2;
    speaker.position.set(sign * SPEAKER_X, 0, FRONT_Z + 0.02);
    group.add(speaker);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(SPEAKER_RADIUS + 0.015, 0.02, 12, 40),
      metalMaterial(0x9aa0a0, 0.7, 0.3),
    );
    rim.position.set(sign * SPEAKER_X, 0, FRONT_Z + 0.02);
    group.add(rim);
  }

  // CD bay: a shallow disc with a center spindle, sitting proud of the
  // chassis face (see BAY_Z) like every other front-mounted part. The disc
  // mesh (added below, toggled by setDiscLoaded) sits at the same depth so
  // it reads as resting in the tray, not floating above it. Low metalness
  // and a flat matte finish keep this reading as a solid tray rather than
  // shiny metal (the original "flashy lights" bug was BAY_Z z-fighting
  // against the chassis front face - see that constant).
  const bayMaterial = metalMaterial(0x11201b, 0, 0.85);
  bayMaterial.envMapIntensity = 0;
  const bay = new THREE.Mesh(new THREE.CylinderGeometry(BAY_RADIUS, BAY_RADIUS, 0.03, 48), bayMaterial);
  bay.rotation.x = Math.PI / 2;
  bay.position.set(0, BAY_Y, BAY_Z);
  group.add(bay);

  // Kept shallow and set proud of the bay by only a small margin, well
  // clear of the closed lid's own front face.
  const spindleMaterial = metalMaterial(0x4a5250, 0, 0.85);
  spindleMaterial.envMapIntensity = 0;
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 24), spindleMaterial);
  spindle.rotation.x = Math.PI / 2;
  spindle.position.set(0, BAY_Y, BAY_Z + 0.01);
  group.add(spindle);

  // The disc lives under its own pivot, tilted flat to face the camera.
  // Spinning happens by rotating `disc` itself around its local Y (the
  // cylinder's own axis, unaffected by the pivot's tilt) so it behaves
  // like a record on a turntable rather than tumbling in world space.
  const discPivot = new THREE.Group();
  discPivot.position.set(0, BAY_Y, BAY_Z + 0.015);
  discPivot.rotation.x = Math.PI / 2;
  discPivot.visible = false;
  group.add(discPivot);

  const discCover = buildDiscCoverTexture();
  const discMaterial = new THREE.MeshStandardMaterial({
    map: discCover.texture,
    metalness: 0.25,
    roughness: 0.35,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(BAY_RADIUS - 0.03, BAY_RADIUS - 0.03, 0.015, 48), discMaterial);
  discPivot.add(disc);

  // Lid: hinged at the bay's top edge, swings up and back to open. Real
  // top-loaders hinge at the back and lift up; modeled here as a pivot
  // group at the hinge line, with the lid mesh offset below the pivot so
  // rotating the pivot swings the lid like a real lid, not a floating
  // panel rotating in place.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, BAY_Y + BAY_RADIUS, BAY_Z + 0.02);
  group.add(lidPivot);

  // Small trim margin only (was +0.06, which pushed the lid's closed
  // bottom edge down into the LCD's own top edge - the two visibly
  // overlapped). +0.03 still fully covers the bay with a hair of trim,
  // clear of the screen below.
  const lidHeight = BAY_RADIUS * 2 + 0.03;
  const lidMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a4744,
    metalness: 0,
    roughness: 0.85,
    transparent: true,
    opacity: 0.82,
  });
  lidMaterial.envMapIntensity = 0;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(BAY_RADIUS * 2 + 0.03, lidHeight, 0.02), lidMaterial);
  lid.position.set(0, -lidHeight / 2, 0.015);
  lid.userData.interactive = 'lid';
  lidPivot.add(lid);

  const lcdMaterial = new THREE.MeshBasicMaterial({ map: lcdTexture });
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(LCD_WIDTH, LCD_HEIGHT), lcdMaterial);
  lcd.position.set(0, LCD_Y, FRONT_Z + 0.02);
  group.add(lcd);

  const buttons = {
    previous: addButton(group, GLYPH_TEXTURES.previous, -2.5 * BUTTON_PITCH, BUTTON_Y, 'previous'),
    playPause: addButton(group, GLYPH_TEXTURES.playPause, -1.5 * BUTTON_PITCH, BUTTON_Y, 'play-pause'),
    stop: addButton(group, GLYPH_TEXTURES.stop, -0.5 * BUTTON_PITCH, BUTTON_Y, 'stop'),
    next: addButton(group, GLYPH_TEXTURES.next, 0.5 * BUTTON_PITCH, BUTTON_Y, 'next'),
    volumeDown: addButton(group, GLYPH_TEXTURES.volumeDown, 1.5 * BUTTON_PITCH, BUTTON_Y, 'volume-down'),
    volumeUp: addButton(group, GLYPH_TEXTURES.volumeUp, 2.5 * BUTTON_PITCH, BUTTON_Y, 'volume-up'),
  };

  group.rotation.y = DEFAULT_ROTATION_Y;

  const interactiveMeshes = [lid, ...Object.values(buttons).map((b) => b.button)];

  return { group, lidPivot, lid, discPivot, disc, discCover, interactiveMeshes };
}

export function createCdPlayerScene(canvas, callbacks = {}) {
  const { onPlayPause, onPrev, onNext, onStop, onVolumeUp, onVolumeDown } = callbacks;

  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.55, 4.6);
  camera.lookAt(0, 0, 0);

  const pmremGenerator = addStandardLighting(scene, renderer);

  const lcd = buildLcdTexture();
  const { group: device, lidPivot, discPivot, disc, discCover, interactiveMeshes } = buildDevice(lcd.texture);
  scene.add(device);

  let lidOpen = false;
  let isPlaying = false;
  let hasDisc = false;
  let lastTitle = '';
  let lastTrackNumber = 1;
  let lastTrackId = null;

  function redrawLcd() {
    drawLcd(lcd.canvas, lcd.texture, { title: lastTitle, trackNumber: lastTrackNumber, isPlaying, hasDisc });
  }
  redrawLcd();

  function redrawDiscCover() {
    drawDiscCover(discCover.canvas, discCover.texture, { title: lastTitle, trackId: lastTrackId });
  }
  redrawDiscCover();

  function triggerAction(hit) {
    const kind = hit.object.userData.interactive;
    if (kind === 'lid') {
      lidOpen = !lidOpen;
      return;
    }
    if (kind === 'play-pause') onPlayPause?.();
    else if (kind === 'stop') onStop?.();
    else if (kind === 'previous') onPrev?.();
    else if (kind === 'next') onNext?.();
    else if (kind === 'volume-up') onVolumeUp?.();
    else if (kind === 'volume-down') onVolumeDown?.();
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

  const LID_ANIM_SPEED = 6; // radians/sec of pivot rotation towards target

  const stop = startAnimationLoop(renderer, scene, camera, controller, (delta) => {
    const targetDeg = lidOpen ? LID_OPEN_DEG : 0;
    const targetRad = (targetDeg * Math.PI) / 180;
    const diff = targetRad - lidPivot.rotation.x;
    if (Math.abs(diff) > 0.001) {
      const step = Math.sign(diff) * Math.min(Math.abs(diff), LID_ANIM_SPEED * delta);
      lidPivot.rotation.x += step;
    }
    // The disc only spins while actually playing - paused or stopped, it
    // sits still in the tray, same as a real player.
    if (isPlaying && hasDisc) {
      disc.rotation.y += DISC_SPIN_SPEED * delta;
    }
  });

  return {
    setTrackInfo(title, trackNumber, trackId) {
      lastTitle = title;
      lastTrackNumber = trackNumber;
      lastTrackId = trackId;
      redrawLcd();
      redrawDiscCover();
    },
    setPlaying(playing) {
      isPlaying = playing;
      redrawLcd();
    },
    setDiscLoaded(loaded) {
      hasDisc = loaded;
      discPivot.visible = loaded;
      redrawLcd();
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
