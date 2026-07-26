import { describe, it, expect, vi } from 'vitest';
import { createDragRotateController, DAMPING, DRAG_TO_RADIANS, CLICK_MOVE_THRESHOLD, CLICK_MOVE_THRESHOLD_TOUCH, AUTO_ROTATE_SPEED, IDLE_FRAME_INTERVAL } from '../src/sceneCore.js';

function makeMockCanvas() {
  const listeners = {};
  return {
    addEventListener: vi.fn((event, handler) => { listeners[event] = handler; }),
    removeEventListener: vi.fn((event, handler) => { delete listeners[event]; }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 500, height: 400 })),
    style: { cursor: '' },
    _listeners: listeners,
  };
}

function makeMockScene() {
  const canvas = makeMockCanvas();
  const camera = { isCamera: true };
  const deviceGroup = { rotation: { y: 0 } };
  const interactiveMeshes = [];
  const onClick = vi.fn();
  return { canvas, camera, deviceGroup, interactiveMeshes, onClick };
}

describe('createDragRotateController', () => {
  it('registers pointercancel event listener', () => {
    const { canvas, camera, deviceGroup, interactiveMeshes } = makeMockScene();
    createDragRotateController({ canvas, camera, deviceGroup, interactiveMeshes });

    const call = canvas.addEventListener.mock.calls.find(c => c[0] === 'pointercancel');
    expect(call).toBeDefined();
    expect(typeof call[1]).toBe('function');
  });

  it('removes pointercancel listener on dispose', () => {
    const { canvas, camera, deviceGroup, interactiveMeshes, onClick } = makeMockScene();
    const controller = createDragRotateController({ canvas, camera, deviceGroup, interactiveMeshes, onClick, defaultRotationY: 0 });
    controller.dispose();

    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointercancel', expect.any(Function));
  });

  it('removes all event listeners on dispose', () => {
    const { canvas, camera, deviceGroup, interactiveMeshes, onClick } = makeMockScene();
    const controller = createDragRotateController({ canvas, camera, deviceGroup, interactiveMeshes, onClick, defaultRotationY: 0 });
    controller.dispose();

    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerleave', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointercancel', expect.any(Function));
  });

  it('exports pointer interaction constants', () => {
    expect(DAMPING).toBe(0.9);
    expect(DRAG_TO_RADIANS).toBe(0.012);
    expect(CLICK_MOVE_THRESHOLD).toBe(6);
    expect(CLICK_MOVE_THRESHOLD_TOUCH).toBe(10);
    expect(AUTO_ROTATE_SPEED).toBe(0.12);
    expect(IDLE_FRAME_INTERVAL).toBe(1 / 30);
  });
});
