import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  metalMaterial,
  createRenderer,
  addStandardLighting,
  makeGlyphTexture,
  drawTriangle,
  createDragRotateController,
  startAnimationLoop,
} from './sceneCore.js';

const DEFAULT_ROTATION_Y = 0.3;

const CHASSIS_WIDTH = 2.7;
const CHASSIS_HEIGHT = 1.15;
const CHASSIS_DEPTH = 0.8;
const FRONT_Z = CHASSIS_DEPTH / 2;

const SPEAKER_RADIUS = 0.44;
const SPEAKER_X = 0.98;

const BAY_RADIUS = 0.24;
const BAY_Y = 0.28;
const BAY_Z = FRONT_Z - 0.015;

const LCD_Y = -0.08;
const LCD_WIDTH = 0.56;
const LCD_HEIGHT = 0.2;

const BUTTON_Y = -0.35;
const BUTTON_SIZE = 0.15;

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
  play: makeGlyphTexture((ctx, s) => drawTriangle(ctx, s * 0.53, s / 2, s * 0.32, 0), '#1d2422'),
  pause: makeGlyphTexture((ctx, s) => {
    const barW = s * 0.16;
    ctx.fillRect(s * 0.34 - barW / 2, s * 0.28, barW, s * 0.44);
    ctx.fillRect(s * 0.66 - barW / 2, s * 0.28, barW, s * 0.44);
  }, '#1d2422'),
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

  // CD bay: a shallow recessed disc with a center spindle. The disc mesh
  // (added below, toggled by setDiscLoaded) sits at the same depth so it
  // reads as resting in the tray, not floating above it.
  const bay = new THREE.Mesh(
    new THREE.CylinderGeometry(BAY_RADIUS, BAY_RADIUS, 0.03, 48),
    metalMaterial(0x11201b, 0.3, 0.6),
  );
  bay.rotation.x = Math.PI / 2;
  bay.position.set(0, BAY_Y, BAY_Z);
  group.add(bay);

  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.05, 24),
    metalMaterial(0x4a5250, 0.6, 0.4),
  );
  spindle.rotation.x = Math.PI / 2;
  spindle.position.set(0, BAY_Y, BAY_Z + 0.02);
  group.add(spindle);

  const discMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfe6e4,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0x35d0a5,
    emissiveIntensity: 0.05,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(BAY_RADIUS - 0.03, BAY_RADIUS - 0.03, 0.015, 48), discMaterial);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, BAY_Y, BAY_Z + 0.015);
  disc.visible = false;
  group.add(disc);

  // Lid: hinged at the bay's top edge, swings up and back to open. Real
  // top-loaders hinge at the back and lift up; modeled here as a pivot
  // group at the hinge line, with the lid mesh offset below the pivot so
  // rotating the pivot swings the lid like a real lid, not a floating
  // panel rotating in place.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, BAY_Y + BAY_RADIUS, BAY_Z + 0.02);
  group.add(lidPivot);

  const lidHeight = BAY_RADIUS * 2 + 0.06;
  const lid = new THREE.Mesh(
    new RoundedBoxGeometry(BAY_RADIUS * 2 + 0.06, lidHeight, 0.02, 4, 0.03),
    new THREE.MeshStandardMaterial({
      color: 0x3a4744,
      metalness: 0.3,
      roughness: 0.25,
      transparent: true,
      opacity: 0.82,
    }),
  );
  lid.position.set(0, -lidHeight / 2, 0.015);
  lid.userData.interactive = 'lid';
  lidPivot.add(lid);

  const lcdMaterial = new THREE.MeshBasicMaterial({ map: lcdTexture });
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(LCD_WIDTH, LCD_HEIGHT), lcdMaterial);
  lcd.position.set(0, LCD_Y, FRONT_Z + 0.02);
  group.add(lcd);

  const buttons = {
    previous: addButton(group, GLYPH_TEXTURES.previous, -0.42, BUTTON_Y, 'previous'),
    playPause: addButton(group, GLYPH_TEXTURES.play, -0.14, BUTTON_Y, 'play-pause'),
    stop: addButton(group, GLYPH_TEXTURES.stop, 0.14, BUTTON_Y, 'stop'),
    next: addButton(group, GLYPH_TEXTURES.next, 0.42, BUTTON_Y, 'next'),
    volumeDown: addButton(group, GLYPH_TEXTURES.volumeDown, 0.85, BUTTON_Y, 'volume-down'),
    volumeUp: addButton(group, GLYPH_TEXTURES.volumeUp, 1.1, BUTTON_Y, 'volume-up'),
  };

  group.rotation.y = DEFAULT_ROTATION_Y;

  const interactiveMeshes = [lid, ...Object.values(buttons).map((b) => b.button)];

  return { group, lidPivot, lid, disc, playPauseGlyph: buttons.playPause.glyph, interactiveMeshes };
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
  const { group: device, lidPivot, disc, playPauseGlyph, interactiveMeshes } = buildDevice(lcd.texture);
  scene.add(device);

  let lidOpen = false;
  let isPlaying = false;
  let hasDisc = false;
  let lastTitle = '';
  let lastTrackNumber = 1;

  function redrawLcd() {
    drawLcd(lcd.canvas, lcd.texture, { title: lastTitle, trackNumber: lastTrackNumber, isPlaying, hasDisc });
  }
  redrawLcd();

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
  });

  return {
    setTrackInfo(title, trackNumber) {
      lastTitle = title;
      lastTrackNumber = trackNumber;
      redrawLcd();
    },
    setPlaying(playing) {
      isPlaying = playing;
      playPauseGlyph.material.map = playing ? GLYPH_TEXTURES.pause : GLYPH_TEXTURES.play;
      playPauseGlyph.material.needsUpdate = true;
      redrawLcd();
    },
    setDiscLoaded(loaded) {
      hasDisc = loaded;
      disc.visible = loaded;
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
