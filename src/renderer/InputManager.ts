import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Simulation } from '../core/Simulation';
import { EntityId } from '../core/types';

/**
 * RTS-style input:
 * - Left click          → select unit (or clear selection)
 * - Left drag           → pan camera (if movement > threshold)
 * - Right click         → move selected units to ground point
 * - Right drag          → orbit camera
 * - Wheel               → zoom
 */
export class InputManager {
  private renderer: Renderer;
  private simulation: Simulation | null = null;

  private isLeftDown = false;
  private isRightDown = false;
  private isPanning = false;
  private isOrbiting = false;

  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;

  private readonly DRAG_THRESHOLD = 5; // pixels

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    const el = renderer.domElement;

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('mousedown', (e) => {
      this.downX = this.lastX = e.clientX;
      this.downY = this.lastY = e.clientY;

      if (e.button === 0) {
        this.isLeftDown = true;
        this.isPanning = false;
      }
      if (e.button === 2 || e.button === 1) {
        this.isRightDown = true;
        this.isOrbiting = false;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.isLeftDown) {
        const dx = e.clientX - this.downX;
        const dy = e.clientY - this.downY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.DRAG_THRESHOLD) {
          // Treat as click → selection
          this.handleSelectClick(e.clientX, e.clientY, e.shiftKey);
        }
        this.isLeftDown = false;
        this.isPanning = false;
      }

      if ((e.button === 2 || e.button === 1) && this.isRightDown) {
        const dx = e.clientX - this.downX;
        const dy = e.clientY - this.downY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.DRAG_THRESHOLD) {
          // Treat as right-click → move order
          this.handleMoveOrder(e.clientX, e.clientY);
        }
        this.isRightDown = false;
        this.isOrbiting = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      if (this.isLeftDown) {
        const totalDx = e.clientX - this.downX;
        const totalDy = e.clientY - this.downY;
        if (!this.isPanning && Math.sqrt(totalDx * totalDx + totalDy * totalDy) > this.DRAG_THRESHOLD) {
          this.isPanning = true;
        }
        if (this.isPanning) this.pan(dx, dy);
      }

      if (this.isRightDown) {
        const totalDx = e.clientX - this.downX;
        const totalDy = e.clientY - this.downY;
        if (!this.isOrbiting && Math.sqrt(totalDx * totalDx + totalDy * totalDy) > this.DRAG_THRESHOLD) {
          this.isOrbiting = true;
        }
        if (this.isOrbiting) this.orbit(dx, dy);
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

  /** Called by Game after simulation is created */
  setSimulation(sim: Simulation) {
    this.simulation = sim;
  }

  // ── Selection ──────────────────────────────────────────────

  private handleSelectClick(clientX: number, clientY: number, additive: boolean) {
    if (!this.simulation) return;

    const hitUnitId = this.raycastUnit(clientX, clientY);
    if (hitUnitId) {
      this.simulation.selectUnit(hitUnitId, additive);
    } else if (!additive) {
      this.simulation.clearSelection();
    }
  }

  private raycastUnit(clientX: number, clientY: number): EntityId | null {
    this.updateMouseNDC(clientX, clientY);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    // Collect unit meshes from the scene
    const unitObjects: THREE.Object3D[] = [];
    this.renderer.scene.traverse((obj) => {
      if (obj.userData?.unitId) unitObjects.push(obj);
    });

    const hits = this.raycaster.intersectObjects(unitObjects, true);
    if (hits.length > 0) {
      // Walk up to find the object that carries unitId
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj) {
        if (obj.userData?.unitId) return obj.userData.unitId as EntityId;
        obj = obj.parent;
      }
    }
    return null;
  }

  // ── Move Order ─────────────────────────────────────────────

  private handleMoveOrder(clientX: number, clientY: number) {
    if (!this.simulation) return;
    if (this.simulation.selected.size === 0) return;

    const point = this.raycastGround(clientX, clientY);
    if (point) {
      this.simulation.orderMoveSelected({ x: point.x, y: 0, z: point.z });
    }
  }

  private raycastGround(clientX: number, clientY: number): THREE.Vector3 | null {
    this.updateMouseNDC(clientX, clientY);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    return hit ? target : null;
  }

  private updateMouseNDC(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  // ── Camera ─────────────────────────────────────────────────

  private pan(dx: number, dy: number) {
    const r = this.renderer;
    const speed = r.cameraDistance * 0.0018;

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
    r.cameraPhi = THREE.MathUtils.clamp(r.cameraPhi + dy * 0.005, 0.25, 1.35);
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
