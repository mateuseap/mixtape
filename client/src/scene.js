import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const ACCENT_HEX = 0x35d0a5;
const DEFAULT_ROTATION_Y = 0.35;
const AUTO_ROTATE_SPEED = 0.12; // radians per second
const DAMPING = 0.9;
const DRAG_TO_RADIANS = 0.012;

function buildGroundShadow() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(15, 20, 18, 0.45)');
  gradient.addColorStop(0.6, 'rgba(15, 20, 18, 0.22)');
  gradient.addColorStop(1, 'rgba(15, 20, 18, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(6, 6);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.02;
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

function buildDevice(screenTexture) {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd7dadb,
    metalness: 0.9,
    roughness: 0.32,
    clearcoat: 0.4,
    clearcoatRoughness: 0.4,
  });
  const bodyGeometry = new RoundedBoxGeometry(1.6, 1, 0.18, 6, 0.09);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const bezelMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a1210,
    metalness: 0.2,
    roughness: 0.15,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });
  const bezelGeometry = new RoundedBoxGeometry(0.98, 0.56, 0.02, 4, 0.035);
  const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
  bezel.position.set(0, 0.16, 0.1);
  group.add(bezel);

  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture });
  const screenGeometry = new THREE.PlaneGeometry(0.9, 0.48);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.set(0, 0.16, 0.112);
  group.add(screen);

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, -0.24, 0.1);
  group.add(wheelGroup);

  const ringMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc7cbcc,
    metalness: 0.85,
    roughness: 0.28,
  });
  const ringGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.02, 48);
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  wheelGroup.add(ring);

  const centerMaterial = new THREE.MeshPhysicalMaterial({
    color: ACCENT_HEX,
    metalness: 0.4,
    roughness: 0.35,
    emissive: ACCENT_HEX,
    emissiveIntensity: 0.12,
  });
  const centerGeometry = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 32);
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  center.rotation.x = Math.PI / 2;
  center.position.z = 0.005;
  wheelGroup.add(center);

  const notchMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8f9494,
    metalness: 0.6,
    roughness: 0.4,
  });
  const notchGeometry = new THREE.CircleGeometry(0.02, 12);
  const notchRadius = 0.27;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const notch = new THREE.Mesh(notchGeometry, notchMaterial);
    notch.position.set(Math.cos(angle) * notchRadius, Math.sin(angle) * notchRadius, 0.011);
    wheelGroup.add(notch);
  }

  const portMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2b2f2f,
    metalness: 0.3,
    roughness: 0.6,
  });
  const portGeometry = new RoundedBoxGeometry(0.14, 0.03, 0.03, 2, 0.01);
  const port = new THREE.Mesh(portGeometry, portMaterial);
  port.position.set(0, -0.47, 0.06);
  group.add(port);

  group.rotation.y = DEFAULT_ROTATION_Y;
  return group;
}

export function createDeviceScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.35, 3.4);
  camera.lookAt(0, 0, 0);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
  keyLight.position.set(2.4, 3, 2.2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xbfe9db, 0.8);
  fillLight.position.set(-2.6, 1.4, -1.6);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x35d0a5, 1.4, 8);
  rimLight.position.set(0, 1.2, -2);
  scene.add(rimLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const groundShadow = buildGroundShadow();
  scene.add(groundShadow);

  const screenTexture = buildScreenTexture();
  const device = buildDevice(screenTexture.texture);
  scene.add(device);
  drawScreen(screenTexture.canvas, screenTexture.texture, 'no track selected', '');

  let targetRotationY = device.rotation.y;
  let rotationVelocity = 0;
  let isDragging = false;
  let lastPointerX = 0;
  let idleTime = 0;

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
    rotationVelocity = 0;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!isDragging) return;
    const deltaX = event.clientX - lastPointerX;
    lastPointerX = event.clientX;
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

  function animate() {
    animationFrame = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

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
      }
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
