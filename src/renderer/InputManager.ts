import * as THREE from 'three';
import { Renderer } from './Renderer';

/**
 * Handles RTS-style camera controls and (later) unit selection / commands.
 *
 * Controls:
 * - Left mouse drag  → pan
 * - Right mouse drag → orbit / rotate
 * - Mouse wheel      → zoom
 * - Middle mouse     → also orbit (optional)
 */
export class InputManager {
  private renderer: Renderer;
  private isPanning = false;
  private isOrbiting = false;
  private lastX = 0;
  private lastY = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    const el = renderer.domElement;

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('mousedown', (e) => {
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      if (e.button === 0) this.isPanning = true;
      if (e.button === 2 || e.button === 1) this.isOrbiting = true;
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.isOrbiting = false;
    });

    window.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      if (this.isPanning) {
        this.pan(dx, dy);
      } else if (this.isOrbiting) {
        this.orbit(dx, dy);
      }
    });

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(e.deltaY);
      },
      { passive: false }
    );
  }

  private pan(dx: number, dy: number) {
    const r = this.renderer;
    // Scale pan speed with camera distance so it feels consistent
    const speed = r.cameraDistance * 0.0018;

    // Move target in the camera's local XZ plane
    const forward = new THREE.Vector3();
    r.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    r.cameraTarget.addScaledVector(right, -dx * speed);
    r.cameraTarget.addScaledVector(forward, dy * speed);
  }

  private orbit(dx: number, dy: number) {
    const r = this.renderer;
    r.cameraTheta -= dx * 0.005;
    r.cameraPhi = THREE.MathUtils.clamp(
      r.cameraPhi + dy * 0.005,
      0.25,
      1.35
    );
  }

  private zoom(deltaY: number) {
    const r = this.renderer;
    r.cameraDistance = THREE.MathUtils.clamp(
      r.cameraDistance + deltaY * 0.04,
      15,
      140
    );
  }
}
