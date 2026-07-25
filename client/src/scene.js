import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const ACCENT_HEX = 0x0f7a63;
const ACCENT_BRIGHT_HEX = 0x35d0a5;
const DEFAULT_ROTATION_Y = 0.35;
const AUTO_ROTATE_SPEED = 0.12; // radians per second
const DAMPING = 0.9;
const DRAG_TO_RADIANS = 0.012;
const CLICK_MOVE_THRESHOLD = 6; // px, above this a pointerdown+up is a drag, not a click

// Ground shadow: a very large, mostly-transparent plane so its physical edge
// never enters the visible frustum. Only a small soft gradient blob near the
// device is actually visible; the falloff completes well before the edge.
function buildGroundShadow() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.09);
  gradient.addColorStop(0, 'rgba(19, 29, 26, 0.32)');
  gradient.addColorStop(0.4, 'rgba(19, 29, 26, 0.14)');
  gradient.addColorStop(0.75, 'rgba(19, 29, 26, 0.03)');
  gradient.addColorStop(1, 'rgba(19, 29, 26, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(24, 24);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.16;
  return mesh;
}

function buildScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}

function drawScreen(canvas, texture, title, artist) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#0c1a14';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(143, 230, 196, 0.25)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = '#8fe6c4';
  ctx.font = '600 34px "Geist Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  const titleText = truncate(ctx, title || 'no track selected', w - 60);
  ctx.fillText(titleText, 30, h / 2 - 30);

  ctx.font = '400 24px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(143, 230, 196, 0.7)';
  const artistText = truncate(ctx, artist || '', w - 60);
  ctx.fillText(artistText, 30, h / 2 + 24);

  ctx.fillStyle = 'rgba(143, 230, 196, 0.5)';
  ctx.beginPath();
  ctx.arc(w - 40, h - 40, 8, 0, Math.PI * 2);
  ctx.fill();

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

// A small transparent canvas texture with a single white glyph drawn by
// `draw(ctx, size)`, used to print real icons on the wheel and center
// button so each clickable zone shows what it does instead of relying on
// a generic decorative dot.
function makeGlyphTexture(draw, color = '#ffffff') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawTriangle(ctx, cx, cy, size, rotationDeg) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, -size * 0.65);
  ctx.lineTo(size * 0.7, 0);
  ctx.lineTo(-size * 0.55, size * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const GLYPH_TEXTURES = {
  play: makeGlyphTexture((ctx, s) => drawTriangle(ctx, s * 0.53, s / 2, s * 0.34, 0)),
  next: makeGlyphTexture((ctx, s) => {
    drawTriangle(ctx, s * 0.38, s / 2, s * 0.22, 0);
    drawTriangle(ctx, s * 0.68, s / 2, s * 0.22, 0);
  }),
  previous: makeGlyphTexture((ctx, s) => {
    drawTriangle(ctx, s * 0.32, s / 2, s * 0.22, 180);
    drawTriangle(ctx, s * 0.62, s / 2, s * 0.22, 180);
  }),
  // Triangles, not a +/- cross: a thin cross's vertical stroke shears into
  // illegible noise at the wheel's top zone, which is heavily foreshortened
  // from this camera angle. A solid triangle silhouette survives that
  // distortion the same way the prev/next arrows already do.
  volumeUp: makeGlyphTexture((ctx, s) => drawTriangle(ctx, s / 2, s * 0.53, s * 0.34, -90), '#2b3230'),
  volumeDown: makeGlyphTexture((ctx, s) => drawTriangle(ctx, s / 2, s * 0.47, s * 0.34, 90), '#2b3230'),
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

// Cheaper than MeshPhysicalMaterial + clearcoat, which requires an extra
// BRDF evaluation per pixel. Tuned metalness/roughness on plain
// MeshStandardMaterial still reads as brushed metal against the room
// environment map, at meaningfully lower per-frame GPU cost.
function metalMaterial(color, metalness, roughness) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

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

  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(CENTER_BUTTON_RADIUS, CENTER_BUTTON_RADIUS, 0.04, 40),
    new THREE.MeshStandardMaterial({
      color: ACCENT_HEX,
      metalness: 0.35,
      roughness: 0.3,
      emissive: ACCENT_HEX,
      emissiveIntensity: 0.15,
    }),
  );
  center.rotation.x = Math.PI / 2;
  center.position.z = 0.03;
  center.userData.interactive = 'center';
  wheelGroup.add(center);

  // Printed icons so each clickable zone shows what it does, like a real
  // click wheel: a play glyph on the center button, and volume/skip
  // glyphs at the ring's four cardinal zones (these are children of
  // wheelGroup directly, not ring, so "up" is simply +Y with no axis
  // flip needed; a default PlaneGeometry already faces +Z toward camera).
  const GLYPH_SIZE = 0.23;
  const GLYPH_RADIUS = WHEEL_RADIUS * 0.72;

  function addGlyph(texture, x, y, z, rotationDeg = 0) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GLYPH_SIZE, GLYPH_SIZE),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    if (rotationDeg) mesh.rotation.z = (rotationDeg * Math.PI) / 180;
    wheelGroup.add(mesh);
  }

  // z is well proud of the ring's own front face (~0.025) so the glyph
  // plane is never near-coplanar with it; too close and the two surfaces
  // z-fight, which reads as illegible noise at grazing viewing angles
  // (worst at the top of the wheel, which this camera sees edge-on).
  const GLYPH_Z = 0.06;
  addGlyph(GLYPH_TEXTURES.play, 0, 0, GLYPH_Z);
  addGlyph(GLYPH_TEXTURES.volumeUp, 0, GLYPH_RADIUS, GLYPH_Z);
  addGlyph(GLYPH_TEXTURES.volumeDown, 0, -GLYPH_RADIUS, GLYPH_Z);
  addGlyph(GLYPH_TEXTURES.previous, -GLYPH_RADIUS, 0, GLYPH_Z);
  addGlyph(GLYPH_TEXTURES.next, GLYPH_RADIUS, 0, GLYPH_Z);

  const port = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.035, 0.03, 2, 0.012),
    metalMaterial(0x2b2f2f, 0.3, 0.6),
  );
  port.position.set(0, -BODY_HEIGHT / 2 + 0.04, BODY_FRONT_Z - 0.01);
  group.add(port);

  group.rotation.y = DEFAULT_ROTATION_Y;
  return { group, wheelGroup, ring, center };
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

export function createDeviceScene(canvas, callbacks = {}) {
  const { onPlayPause, onPrev, onNext, onVolumeUp, onVolumeDown } = callbacks;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.1, 5.1);
  camera.lookAt(0, 0, 0);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  const keyLight = new THREE.DirectionalLight(0xf5f8f7, 2.6);
  keyLight.position.set(2.6, 3.2, 2.6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xbfe9db, 0.9);
  fillLight.position.set(-2.8, 1.6, -1.6);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(ACCENT_BRIGHT_HEX, 1.6, 8);
  rimLight.position.set(0, 1.4, -2.2);
  scene.add(rimLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const groundShadow = buildGroundShadow();
  scene.add(groundShadow);

  const screenTexture = buildScreenTexture();
  const { group: device, ring, center } = buildDevice(screenTexture.texture);
  scene.add(device);
  drawScreen(screenTexture.canvas, screenTexture.texture, 'no track selected', '');

  let targetRotationY = device.rotation.y;
  let rotationVelocity = 0;
  let isDragging = false;
  let lastPointerX = 0;
  let idleTime = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let totalMove = 0;

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const interactiveMeshes = [ring, center];

  function setPointerNDC(event) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function hitTest(event) {
    setPointerNDC(event);
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(interactiveMeshes, false);
    return hits.length > 0 ? hits[0] : null;
  }

  function triggerAction(hit) {
    const kind = hit.object.userData.interactive;
    if (kind === 'center') {
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

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }

  function onPointerDown(event) {
    isDragging = true;
    lastPointerX = event.clientX;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    totalMove = 0;
    rotationVelocity = 0;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!isDragging) {
      const hit = hitTest(event);
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      return;
    }
    const deltaX = event.clientX - lastPointerX;
    lastPointerX = event.clientX;
    totalMove = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
    const delta = deltaX * DRAG_TO_RADIANS;
    device.rotation.y += delta;
    targetRotationY = device.rotation.y;
    rotationVelocity = delta;
    idleTime = 0;
  }

  function onPointerUp(event) {
    isDragging = false;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // pointer capture may already be released
    }
    if (totalMove < CLICK_MOVE_THRESHOLD) {
      const hit = hitTest(event);
      if (hit) triggerAction(hit);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const clock = new THREE.Clock();
  let animationFrame = null;
  // Slow idle auto-rotation doesn't need a full 60fps to look smooth; only
  // throttle during that phase, never while the user is actively dragging
  // or during momentum, so interaction always stays fully responsive.
  const IDLE_FRAME_INTERVAL = 1 / 30;
  let timeSinceRender = 0;

  function animate() {
    animationFrame = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    let isIdleRotating = false;

    if (isDragging) {
      idleTime = 0;
    } else if (Math.abs(rotationVelocity) > 0.0001) {
      device.rotation.y += rotationVelocity;
      rotationVelocity *= DAMPING;
      idleTime = 0;
    } else {
      idleTime += delta;
      if (idleTime > 0.6) {
        device.rotation.y += AUTO_ROTATE_SPEED * delta;
        isIdleRotating = true;
      }
    }

    if (isIdleRotating) {
      timeSinceRender += delta;
      if (timeSinceRender < IDLE_FRAME_INTERVAL) return;
      timeSinceRender = 0;
    } else {
      timeSinceRender = 0;
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    updateScreen(title, artist) {
      drawScreen(screenTexture.canvas, screenTexture.texture, title, artist);
    },
    resetRotation() {
      rotationVelocity = 0;
      device.rotation.y = DEFAULT_ROTATION_Y;
      idleTime = 0;
    },
    dispose() {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      pmremGenerator.dispose();
      renderer.dispose();
    },
  };
}
