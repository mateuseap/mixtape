import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const DAMPING = 0.9;
export const DRAG_TO_RADIANS = 0.012;
export const CLICK_MOVE_THRESHOLD = 6; // px, above this a pointerdown+up is a drag, not a click
export const CLICK_MOVE_THRESHOLD_TOUCH = 10;
export const AUTO_ROTATE_SPEED = 0.12; // radians per second
export const IDLE_FRAME_INTERVAL = 1 / 30; // throttle idle auto-rotate rendering to 30fps

// Cheaper than MeshPhysicalMaterial + clearcoat, which requires an extra
// BRDF evaluation per pixel. Tuned metalness/roughness on plain
// MeshStandardMaterial still reads as brushed metal against the room
// environment map, at meaningfully lower per-frame GPU cost.
export function metalMaterial(color, metalness, roughness) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

// Standard three-point-ish rig used by every device: a soft room
// environment for realistic metal reflections, plus a warm key, a cool
// fill, and a teal rim light so accent-colored parts pick up a glint.
// Returns the PMREMGenerator so the caller can dispose it later.
export function addStandardLighting(scene, renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  const keyLight = new THREE.DirectionalLight(0xf5f8f7, 2.6);
  keyLight.position.set(2.6, 3.2, 2.6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xbfe9db, 0.9);
  fillLight.position.set(-2.8, 1.6, -1.6);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x35d0a5, 1.6, 8);
  rimLight.position.set(0, 1.4, -2.2);
  scene.add(rimLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  return pmremGenerator;
}

// A small transparent canvas texture with a single glyph drawn by
// `draw(ctx, size)`, used to print real icons on device controls so each
// clickable zone shows what it does instead of relying on a plain color.
export function makeGlyphTexture(draw, color = '#ffffff') {
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

export function drawTriangle(ctx, cx, cy, size, rotationDeg) {
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

// A single static combined play/pause icon. Real transport controls print
// one fixed glyph per button and never change it - the button itself never
// tells you whether you're about to play or pause, only the device's own
// display (a spinning reel, a lit LED, an LCD readout) shows which state
// you're in. Used identically by both the MP3 wheel's center button and the
// CD player's play/pause button, so neither swaps its icon based on state.
export function drawPlayPauseGlyph(ctx, s) {
  drawTriangle(ctx, s * 0.3, s / 2, s * 0.22, 0);
  const barW = s * 0.1;
  const barH = s * 0.42;
  const barY = s / 2 - barH / 2;
  ctx.fillRect(s * 0.58, barY, barW, barH);
  ctx.fillRect(s * 0.76, barY, barW, barH);
}

// Handles the full pointer interaction contract shared by every device:
// drag-to-rotate around Y with momentum, idle auto-rotation that pauses
// the instant the user touches the canvas, hover cursor feedback, and
// click-vs-drag disambiguation (a pointerdown+up that moved less than
// CLICK_MOVE_THRESHOLD raycasts against `interactiveMeshes` and calls
// `onClick(hit)`; a real drag never triggers it).
export function createDragRotateController({ canvas, camera, deviceGroup, interactiveMeshes, defaultRotationY, onClick }) {
  let rotationVelocity = 0;
  let isDragging = false;
  let lastPointerX = 0;
  let idleTime = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let clickMoveThreshold = CLICK_MOVE_THRESHOLD;

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

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

  function onPointerDown(event) {
    isDragging = true;
    lastPointerX = event.clientX;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    rotationVelocity = 0;
    clickMoveThreshold = event.pointerType === 'touch' ? CLICK_MOVE_THRESHOLD_TOUCH : CLICK_MOVE_THRESHOLD;
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
    const delta = deltaX * DRAG_TO_RADIANS;
    deviceGroup.rotation.y += delta;
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
    // Some mobile browsers fire pointercancel with clientX=0,clientY=0,
    // which would make the tap distance check fail (distance from the
    // actual touch start to (0,0) is always huge).  Fall back to the
    // last known good coordinates (recorded at pointerdown) when the
    // event has no reliable position.
    const fallback = event.clientX === 0 && event.clientY === 0;
    const px = fallback ? pointerDownX : event.clientX;
    const py = fallback ? pointerDownY : event.clientY;
    const tapDist = Math.hypot(px - pointerDownX, py - pointerDownY);
    if (tapDist < clickMoveThreshold) {
      const hit = hitTest(fallback ? { clientX: pointerDownX, clientY: pointerDownY } : event);
      if (hit) onClick?.(hit);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  return {
    // Called once per animation frame. Returns true if this frame is a
    // throttleable idle-auto-rotate frame (no user interaction driving it).
    step(delta) {
      let isIdleRotating = false;
      if (isDragging) {
        idleTime = 0;
      } else if (Math.abs(rotationVelocity) > 0.0001) {
        deviceGroup.rotation.y += rotationVelocity;
        rotationVelocity *= DAMPING;
        idleTime = 0;
      } else {
        idleTime += delta;
        if (idleTime > 0.6) {
          deviceGroup.rotation.y += AUTO_ROTATE_SPEED * delta;
          isIdleRotating = true;
        }
      }
      return isIdleRotating;
    },
    resetRotation() {
      rotationVelocity = 0;
      deviceGroup.rotation.y = defaultRotationY;
      idleTime = 0;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    },
  };
}

// Runs the render loop, throttling to IDLE_FRAME_INTERVAL only while
// `controller.step()` reports an idle-rotate frame; drag and momentum
// frames always render immediately so interaction stays fully responsive.
export function startAnimationLoop(renderer, scene, camera, controller, extraStep) {
  const clock = new THREE.Clock();
  let animationFrame = null;
  let timeSinceRender = 0;

  function animate() {
    animationFrame = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const isIdleRotating = controller.step(delta);
    extraStep?.(delta);

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

  return () => cancelAnimationFrame(animationFrame);
}
