import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Simulation } from '../core/Simulation';
import { EntityId } from '../core/types';

export class InputManager {
  private renderer: Renderer;
  private simulation: Simulation | null = null;

  private isLeftDown = false;
  private isRightDown = false;
  private isPanning = false;
  private isOrbiting = false;
  private isBoxSelecting = false;

  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;

  private readonly DRAG_THRESHOLD = 5;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private selectionBoxEl: HTMLDivElement;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    const el = renderer.domElement;

    this.selectionBoxEl = document.createElement('div');
    this.selectionBoxEl.style.cssText = `
      position: absolute;
      border: 1px solid #44ff88;
      background: rgba(68, 255, 136, 0.12);
      pointer-events: none;
      display: none;
      z-index: 20;
    `;
    document.getElementById('app')?.appendChild(this.selectionBoxEl);

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('mousedown', (e) => {
      this.downX = this.lastX = e.clientX;
      this.downY = this.lastY = e.clientY;

      if (e.button === 0) {
        this.isLeftDown = true;
        this.isPanning = false;
        this.isBoxSelecting = false;
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

        if (this.isBoxSelecting) {
          this.finishBoxSelect(e.clientX, e.clientY, e.shiftKey);
        } else if (dist < this.DRAG_THRESHOLD) {
          this.handleSelectClick(e.clientX, e.clientY, e.shiftKey);
        }

        this.isLeftDown = false;
        this.isPanning = false;
        this.isBoxSelecting = false;
        this.selectionBoxEl.style.display = 'none';
      }

      if ((e.button === 2 || e.button === 1) && this.isRightDown) {
        const dx = e.clientX - this.downX;
        const dy = e.clientY - this.downY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.DRAG_THRESHOLD) {
          this.handleRightClick(e.clientX, e.clientY);
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
        const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

        if (totalDist > this.DRAG_THRESHOLD) {
          if (e.shiftKey) {
            this.isPanning = true;
            this.isBoxSelecting = false;
            this.selectionBoxEl.style.display = 'none';
          } else if (!this.isPanning) {
            this.isBoxSelecting = true;
            this.updateSelectionBox(e.clientX, e.clientY);
          }
        }

        if (this.isPanning) this.pan(dx, dy);
        if (this.isBoxSelecting) this.updateSelectionBox(e.clientX, e.clientY);
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

    window.addEventListener('keydown', (e) => {
      if (!this.simulation) return;
      const sim = this.simulation;

      switch (e.code) {
        case 'KeyF':
          sim.tryBuildFarm();
          break;
        case 'KeyB':
          sim.tryBuildBarracks();
          break;
        case 'KeyL':
          sim.tryBuildLibrary();
          break;
        case 'KeyT':
          sim.tryTrainLegionary();
          break;
        case 'KeyC':
          sim.tryFoundCity();
          break;
        case 'Digit1':
          sim.tryResearch('science');
          break;
        case 'Digit2':
          sim.tryResearch('civic');
          break;
        case 'Digit3':
          sim.tryResearch('military');
          break;
        case 'Digit4':
          sim.tryResearch('commerce');
          break;
      }
    });
  }

  setSimulation(sim: Simulation) {
    this.simulation = sim;
  }

  private updateSelectionBox(clientX: number, clientY: number) {
    const x = Math.min(this.downX, clientX);
    const y = Math.min(this.downY, clientY);
    const w = Math.abs(clientX - this.downX);
    const h = Math.abs(clientY - this.downY);

    this.selectionBoxEl.style.left = `${x}px`;
    this.selectionBoxEl.style.top = `${y}px`;
    this.selectionBoxEl.style.width = `${w}px`;
    this.selectionBoxEl.style.height = `${h}px`;
    this.selectionBoxEl.style.display = 'block';
  }

  private finishBoxSelect(clientX: number, clientY: number, additive: boolean) {
    if (!this.simulation) return;

    const x1 = Math.min(this.downX, clientX);
    const y1 = Math.min(this.downY, clientY);
    const x2 = Math.max(this.downX, clientX);
    const y2 = Math.max(this.downY, clientY);

    const selected: EntityId[] = [];
    const cam = this.renderer.camera;
    const rect = this.renderer.domElement.getBoundingClientRect();

    for (const unit of this.simulation.getAllUnits()) {
      if (unit.nation !== 'rome') continue;
      const pos = new THREE.Vector3(unit.position.x, 1.0, unit.position.z);
      pos.project(cam);
      const sx = ((pos.x + 1) / 2) * rect.width + rect.left;
      const sy = ((-pos.y + 1) / 2) * rect.height + rect.top;
      if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) selected.push(unit.id);
    }

    this.simulation.selectUnits(selected, additive);
  }

  private handleSelectClick(clientX: number, clientY: number, additive: boolean) {
    if (!this.simulation) return;

    const hitUnitId = this.raycastWithUserData(clientX, clientY, 'unitId');
    if (hitUnitId) {
      this.simulation.selectUnit(hitUnitId, additive);
      return;
    }

    const hitBuildingId = this.raycastWithUserData(clientX, clientY, 'buildingId');
    if (hitBuildingId) {
      this.simulation.selectBuilding(hitBuildingId);
      return;
    }

    if (!additive) this.simulation.clearSelection();
  }

  private handleRightClick(clientX: number, clientY: number) {
    if (!this.simulation) return;
    if (this.simulation.selected.size === 0) return;

    // Attack enemy unit if clicked
    const hitUnitId = this.raycastWithUserData(clientX, clientY, 'unitId');
    if (hitUnitId) {
      const unit = this.simulation.units.get(hitUnitId);
      if (unit && unit.nation !== 'rome') {
        this.simulation.orderAttackSelected(hitUnitId);
        return;
      }
    }

    // Gather resource
    const nodeId = this.raycastWithUserData(clientX, clientY, 'resourceNodeId');
    if (nodeId) {
      this.simulation.orderGatherSelected(nodeId);
      return;
    }

    // Move
    const point = this.raycastGround(clientX, clientY);
    if (point) {
      this.simulation.orderMoveSelected({ x: point.x, y: 0, z: point.z });
    }
  }

  private raycastWithUserData(
    clientX: number,
    clientY: number,
    key: string
  ): EntityId | null {
    this.updateMouseNDC(clientX, clientY);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

    const objs: THREE.Object3D[] = [];
    this.renderer.scene.traverse((obj) => {
      if (obj.userData?.[key]) objs.push(obj);
    });

    const hits = this.raycaster.intersectObjects(objs, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj) {
        if (obj.userData?.[key]) return obj.userData[key] as EntityId;
        obj = obj.parent;
      }
    }
    return null;
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
