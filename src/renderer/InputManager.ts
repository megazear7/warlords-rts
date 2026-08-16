import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Simulation } from '../core/Simulation';
import { EntityId } from '../core/types';
import type { Game } from '../Game';

/**
 * Full InputManager — box select, edge-scroll, attack-move (A), wall (H/Mil2),
 * tower (Y/Mil1), market (M/Com1), U/I trade, V citizen, G general,
 * T/R/Q/W train, F1-F4 research, E epoch, control groups, rally, etc.
 * Authoritative source: project artifacts.
 */
export class InputManager {
  private renderer: Renderer;
  private sim: Simulation;
  private game?: Game;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private isLeftDown = false;
  private isRightDown = false;
  private isBoxSelecting = false;
  private downX = 0;
  private downY = 0;
  private attackMoveMode = false;
  private edgeScroll = true;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private selectionBoxEl: HTMLDivElement;

  constructor(renderer: Renderer, sim: Simulation, game?: Game) {
    this.renderer = renderer;
    this.sim = sim;
    this.game = game;

    this.selectionBoxEl = document.createElement('div');
    this.selectionBoxEl.style.cssText =
      'position:fixed;border:1px solid #4f4;background:rgba(80,255,80,0.12);pointer-events:none;z-index:50;display:none;';
    document.getElementById('app')?.appendChild(this.selectionBoxEl);

    const el = renderer.domElement;
    el.addEventListener('mousedown', this.onMouseDown);
    el.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('mouseup', this.onMouseUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  dispose() {
    const el = this.renderer.domElement;
    el.removeEventListener('mousedown', this.onMouseDown);
    el.removeEventListener('mousemove', this.onMouseMove);
    el.removeEventListener('mouseup', this.onMouseUp);
    el.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.selectionBoxEl.remove();
  }

  setEdgeScroll(enabled: boolean) {
    this.edgeScroll = enabled;
  }

  update(dt: number) {
    if (!this.edgeScroll || !this.isGameplay()) return;
    if (this.isLeftDown || this.isRightDown || this.isBoxSelecting) return;
    const margin = 28;
    const speed = 32 * dt;
    const w = window.innerWidth;
    const h = window.innerHeight;
    let dx = 0, dz = 0;
    if (this.lastMouseX < margin) dx = -1;
    else if (this.lastMouseX > w - margin) dx = 1;
    if (this.lastMouseY < margin) dz = -1;
    else if (this.lastMouseY > h - margin) dz = 1;
    if (dx === 0 && dz === 0) return;
    const theta = this.renderer.cameraTheta;
    this.renderer.cameraTarget.x += (dx * Math.cos(theta) - dz * Math.sin(theta)) * speed;
    this.renderer.cameraTarget.z += (dx * Math.sin(theta) + dz * Math.cos(theta)) * speed;
  }

  private isGameplay(): boolean {
    return !!(this.game as any)?.isGameplay?.();
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.renderer.cameraDistance = Math.max(18, Math.min(120, this.renderer.cameraDistance + e.deltaY * 0.04));
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || !this.isGameplay()) return;
    const sim = this.sim;
    const audio = (this.game as any)?.audio;

    if (e.ctrlKey && e.code.startsWith('Digit')) {
      const slot = parseInt(e.code.replace('Digit', ''), 10);
      if (slot >= 0 && slot <= 9) { sim.assignControlGroup(slot); return; }
    }
    if (!e.ctrlKey && e.code.startsWith('Digit')) {
      const slot = parseInt(e.code.replace('Digit', ''), 10);
      if (slot >= 0 && slot <= 9) { sim.selectControlGroup(slot); return; }
    }

    switch (e.code) {
      case 'KeyA':
        this.attackMoveMode = true;
        this.game?.ui?.showToast?.('Attack-move: right-click destination');
        break;
      case 'KeyF':
        if (sim.tryBuildFarm()) audio?.play?.('build_place');
        break;
      case 'KeyB':
        if (sim.tryBuildBarracks()) audio?.play?.('build_place');
        break;
      case 'KeyL':
        if (sim.tryBuildLibrary()) audio?.play?.('build_place');
        break;
      case 'KeyY':
        if (sim.tryBuildTower()) audio?.play?.('build_place');
        else this.game?.ui?.showToast?.('Need Military research 1+ · select citizens · 80 timber, 30 wealth');
        break;
      case 'KeyM':
        if (sim.tryBuildMarket()) audio?.play?.('build_place');
        else this.game?.ui?.showToast?.('Need Commerce research 1+ · select citizens · 70 timber, 25 wealth');
        break;
      case 'KeyH':
        if (sim.tryBuildWall()) audio?.play?.('build_place');
        else this.game?.ui?.showToast?.('Need Military research 2+ · select citizens · 40 timber, 20 wealth');
        break;
      case 'KeyU':
        if (sim.trySellFood(50)) this.game?.ui?.showToast?.('Sold 50 food for wealth');
        else this.game?.ui?.showToast?.('Need market + 50 food');
        break;
      case 'KeyI':
        if (sim.tryBuyMetal(20)) this.game?.ui?.showToast?.('Bought 20 metal');
        else this.game?.ui?.showToast?.('Need market + wealth');
        break;
      case 'KeyV':
        if (!sim.tryTrainCitizen()) this.game?.ui?.showToast?.('Select city center · costs 50 food');
        break;
      case 'KeyT': sim.tryTrainLegionary(); break;
      case 'KeyR':
        if (!sim.tryTrainElite()) this.game?.ui?.showToast?.('Elite unit locked (advance epoch)');
        break;
      case 'KeyQ': sim.tryTrainScout(); break;
      case 'KeyW': sim.tryTrainWagon(); break;
      case 'KeyG':
        if (!sim.tryTrainGeneral()) this.game?.ui?.showToast?.('Select barracks · needs Military research 1+ · max 2 generals');
        break;
      case 'KeyC':
        if (!sim.tryFoundCity()) this.game?.ui?.showToast?.('Need timber+wealth · far from other cities');
        break;
      case 'KeyE':
        if (!sim.tryAdvanceEpoch()) this.game?.ui?.showToast?.('Need knowledge + wealth for next epoch');
        break;
      case 'F1': e.preventDefault(); sim.tryResearch('science'); break;
      case 'F2': e.preventDefault(); sim.tryResearch('civic'); break;
      case 'F3': e.preventDefault(); sim.tryResearch('military'); break;
      case 'F4': e.preventDefault(); sim.tryResearch('commerce'); break;
      case 'KeyS':
        if (!e.ctrlKey) this.game?.quickSave?.(1);
        break;
      case 'Escape':
        this.game?.togglePause?.();
        break;
    }
  };

  private onKeyUp = (_e: KeyboardEvent) => {};

  private onMouseDown = (e: MouseEvent) => {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    if (e.button === 0) {
      this.isLeftDown = true;
      this.downX = e.clientX;
      this.downY = e.clientY;
      if (!e.shiftKey) {
        // start potential box select
      }
    } else if (e.button === 2) {
      this.isRightDown = true;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (this.isLeftDown && !e.shiftKey) {
      const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      if (dist > 6) {
        this.isBoxSelecting = true;
        this.updateSelectionBox(e.clientX, e.clientY);
      }
    }

    if (e.buttons === 4 || (e.buttons === 1 && e.shiftKey)) {
      const dx = e.movementX * 0.08;
      const dz = e.movementY * 0.08;
      const theta = this.renderer.cameraTheta;
      this.renderer.cameraTarget.x -= dx * Math.cos(theta) + dz * Math.sin(theta);
      this.renderer.cameraTarget.z -= -dx * Math.sin(theta) + dz * Math.cos(theta);
    }
    if (e.buttons === 2) {
      this.renderer.cameraTheta -= e.movementX * 0.005;
      this.renderer.cameraPhi = Math.max(0.2, Math.min(1.4, this.renderer.cameraPhi - e.movementY * 0.005));
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isLeftDown = false;
      if (this.isBoxSelecting) {
        this.finishBoxSelect(e.clientX, e.clientY, e.shiftKey);
        this.isBoxSelecting = false;
        this.selectionBoxEl.style.display = 'none';
      } else {
        this.handleLeftClick(e);
      }
    } else if (e.button === 2) {
      this.isRightDown = false;
      this.handleRightClick(e);
    }
  };

  private updateSelectionBox(clientX: number, clientY: number) {
    const x = Math.min(this.downX, clientX);
    const y = Math.min(this.downY, clientY);
    this.selectionBoxEl.style.left = x + 'px';
    this.selectionBoxEl.style.top = y + 'px';
    this.selectionBoxEl.style.width = Math.abs(clientX - this.downX) + 'px';
    this.selectionBoxEl.style.height = Math.abs(clientY - this.downY) + 'px';
    this.selectionBoxEl.style.display = 'block';
  }

  private finishBoxSelect(clientX: number, clientY: number, additive: boolean) {
    const sim = this.sim;
    if (!additive) sim.clearSelection();
    // Project unit positions to screen and select those inside the rect
    const x1 = Math.min(this.downX, clientX);
    const y1 = Math.min(this.downY, clientY);
    const x2 = Math.max(this.downX, clientX);
    const y2 = Math.max(this.downY, clientY);
    const cam = this.renderer.camera;
    const v = new THREE.Vector3();
    for (const u of sim.getAllUnits()) {
      if (u.nation !== sim.playerNation || u.hp <= 0) continue;
      v.set(u.position.x, u.position.y + 1, u.position.z);
      v.project(cam);
      const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) {
        sim.addToSelection(u.id);
      }
    }
  }

  private handleLeftClick(e: MouseEvent) {
    const sim = this.sim;
    const hitUnitId = this.raycastWithUserData(e.clientX, e.clientY, 'unitId');
    if (hitUnitId) {
      const u = sim.getUnit(hitUnitId);
      if (u && u.nation === sim.playerNation) {
        if (e.shiftKey) sim.addToSelection(hitUnitId);
        else sim.selectUnit(hitUnitId);
        return;
      }
    }
    const hitBuildingId = this.raycastWithUserData(e.clientX, e.clientY, 'buildingId');
    if (hitBuildingId) {
      const b = sim.getBuilding(hitBuildingId);
      if (b && b.nation === sim.playerNation) {
        sim.selectBuilding(hitBuildingId);
        return;
      }
    }
    if (!e.shiftKey) sim.clearSelection();
  }

  private handleRightClick(e: MouseEvent) {
    const sim = this.sim;
    // Rally point
    if (sim.getSelectedBuilding()) {
      const point = this.raycastGround(e.clientX, e.clientY);
      if (point) {
        sim.setRallyPoint({ x: point.x, y: 0, z: point.z });
        return;
      }
    }

    if (this.attackMoveMode) {
      const point = this.raycastGround(e.clientX, e.clientY);
      if (point) {
        sim.orderAttackMoveSelected({ x: point.x, y: 0, z: point.z });
        this.attackMoveMode = false;
        return;
      }
    }

    const hitUnitId = this.raycastWithUserData(e.clientX, e.clientY, 'unitId');
    if (hitUnitId) {
      const u = sim.getUnit(hitUnitId);
      if (u && u.nation !== sim.playerNation) {
        sim.orderAttack(hitUnitId);
        return;
      }
    }
    const hitBuildingId = this.raycastWithUserData(e.clientX, e.clientY, 'buildingId');
    if (hitBuildingId) {
      const b = sim.getBuilding(hitBuildingId);
      if (b && b.nation !== sim.playerNation) {
        sim.orderSiege(hitBuildingId);
        return;
      }
    }
    const nodeId = this.raycastWithUserData(e.clientX, e.clientY, 'resourceNodeId');
    if (nodeId) {
      sim.orderGather(nodeId);
      return;
    }
    const point = this.raycastGround(e.clientX, e.clientY);
    if (point) {
      sim.orderMoveSelected({ x: point.x, y: 0, z: point.z });
    }
  }

  private raycastWithUserData(clientX: number, clientY: number, key: string): EntityId | null {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    const objs: THREE.Object3D[] = [];
    this.renderer.scene.traverse((o) => {
      if ((o as any).userData?.[key]) objs.push(o);
    });
    const hits = this.raycaster.intersectObjects(objs, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if ((o as any).userData?.[key]) return (o as any).userData[key];
        o = o.parent;
      }
    }
    return null;
  }

  private raycastGround(clientX: number, clientY: number): THREE.Vector3 | null {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    const target = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, target) ? target : null;
  }
}
