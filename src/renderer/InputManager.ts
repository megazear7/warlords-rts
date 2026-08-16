import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Simulation } from '../core/Simulation';
import { EntityId } from '../core/types';
import type { Game } from '../Game';

export class InputManager {
  private renderer: Renderer;
  private sim: Simulation;
  private game?: Game;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private isDragging = false;
  private dragStart = new THREE.Vector2();
  private dragEnd = new THREE.Vector2();
  private boxEl: HTMLDivElement | null = null;
  private attackMoveMode = false;
  private edgeScrollEnabled = true;
  private keys = new Set<string>();

  constructor(renderer: Renderer, sim: Simulation, game?: Game) {
    this.renderer = renderer;
    this.sim = sim;
    this.game = game;

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
    this.boxEl?.remove();
  }

  update(dt: number) {
    // Edge scroll
    if (this.edgeScrollEnabled && this.game?.settings?.edgeScroll !== false) {
      const margin = 28;
      const speed = 28 * dt;
      const w = window.innerWidth;
      const h = window.innerHeight;
      // simple pointer tracking via last mouse
      // (full edge scroll uses last known mouse coords; simplified here)
    }
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.renderer.cameraDistance = Math.max(
      18,
      Math.min(120, this.renderer.cameraDistance + e.deltaY * 0.04)
    );
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const sim = this.sim;
    const audio = (this.game as any)?.audio;
    this.keys.add(e.code);

    // Control groups
    if (e.ctrlKey && e.code.startsWith('Digit')) {
      const slot = parseInt(e.code.replace('Digit', ''), 10);
      if (slot >= 0 && slot <= 9) {
        sim.assignControlGroup(slot);
        return;
      }
    }
    if (!e.ctrlKey && e.code.startsWith('Digit')) {
      const slot = parseInt(e.code.replace('Digit', ''), 10);
      if (slot >= 0 && slot <= 9) {
        sim.selectControlGroup(slot);
        return;
      }
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
        if (!sim.tryTrainCitizen()) {
          this.game?.ui?.showToast?.('Select city center · costs 50 food');
        }
        break;
      case 'KeyT':
        sim.tryTrainLegionary();
        break;
      case 'KeyR':
        if (!sim.tryTrainElite()) this.game?.ui?.showToast?.('Elite unit locked (advance epoch)');
        break;
      case 'KeyQ':
        sim.tryTrainScout();
        break;
      case 'KeyW':
        sim.tryTrainWagon();
        break;
      case 'KeyG':
        if (!sim.tryTrainGeneral()) {
          this.game?.ui?.showToast?.('Select barracks · needs Military research 1+ · max 2 generals');
        }
        break;
      case 'KeyC':
        if (!sim.tryFoundCity()) this.game?.ui?.showToast?.('Need timber+wealth · far from other cities');
        break;
      case 'KeyE':
        if (!sim.tryAdvanceEpoch()) this.game?.ui?.showToast?.('Need knowledge + wealth for next epoch');
        break;
      case 'F1':
        e.preventDefault();
        sim.tryResearch('science');
        break;
      case 'F2':
        e.preventDefault();
        sim.tryResearch('civic');
        break;
      case 'F3':
        e.preventDefault();
        sim.tryResearch('military');
        break;
      case 'F4':
        e.preventDefault();
        sim.tryResearch('commerce');
        break;
      case 'KeyS':
        if (!e.ctrlKey) this.game?.quickSave?.(1);
        break;
      case 'Escape':
        this.game?.togglePause?.();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isDragging = true;
      this.dragStart.set(e.clientX, e.clientY);
      this.dragEnd.copy(this.dragStart);
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (this.isDragging) {
      this.dragEnd.set(e.clientX, e.clientY);
      this.updateBoxSelectVisual();
    }

    // Camera pan with middle or shift+left
    if (e.buttons === 4 || (e.buttons === 1 && e.shiftKey)) {
      const dx = e.movementX * 0.08;
      const dz = e.movementY * 0.08;
      const theta = this.renderer.cameraTheta;
      this.renderer.cameraTarget.x -= dx * Math.cos(theta) + dz * Math.sin(theta);
      this.renderer.cameraTarget.z -= -dx * Math.sin(theta) + dz * Math.cos(theta);
    }
    // Orbit with right drag
    if (e.buttons === 2) {
      this.renderer.cameraTheta -= e.movementX * 0.005;
      this.renderer.cameraPhi = Math.max(
        0.2,
        Math.min(1.4, this.renderer.cameraPhi - e.movementY * 0.005)
      );
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isDragging = false;
      this.boxEl?.remove();
      this.boxEl = null;

      const dist = this.dragStart.distanceTo(this.dragEnd);
      if (dist < 6) {
        // Click select
        this.handleLeftClick(e);
      } else {
        // Box select
        this.handleBoxSelect(e.shiftKey);
      }
    } else if (e.button === 2) {
      // Right-click: move / attack / attack-move / rally
      this.handleRightClick(e);
    }
  };

  private updateBoxSelectVisual() {
    if (!this.boxEl) {
      this.boxEl = document.createElement('div');
      this.boxEl.style.cssText =
        'position:fixed;border:1px solid #4f4;background:rgba(80,255,80,0.12);pointer-events:none;z-index:50;';
      document.body.appendChild(this.boxEl);
    }
    const x1 = Math.min(this.dragStart.x, this.dragEnd.x);
    const y1 = Math.min(this.dragStart.y, this.dragEnd.y);
    const x2 = Math.max(this.dragStart.x, this.dragEnd.x);
    const y2 = Math.max(this.dragStart.y, this.dragEnd.y);
    this.boxEl.style.left = x1 + 'px';
    this.boxEl.style.top = y1 + 'px';
    this.boxEl.style.width = x2 - x1 + 'px';
    this.boxEl.style.height = y2 - y1 + 'px';
  }

  private handleBoxSelect(additive: boolean) {
    // Simplified: select all player units in screen rect (full version uses projected positions)
    // For now rely on Simulation helpers if available; otherwise skip detailed projection
    const sim = this.sim;
    if (!additive) sim.clearSelection();
    // Full box select logic lives in the authoritative artifacts version
  }

  private handleLeftClick(e: MouseEvent) {
    const sim = this.sim;
    const hit = this.raycastGroundOrEntity();
    if (!hit) {
      if (!e.shiftKey) sim.clearSelection();
      return;
    }
    if (hit.type === 'unit' && hit.nation === sim.playerNation) {
      if (e.shiftKey) sim.addToSelection(hit.id);
      else sim.selectUnit(hit.id);
    } else if (hit.type === 'building' && hit.nation === sim.playerNation) {
      sim.selectBuilding(hit.id);
    } else if (!e.shiftKey) {
      sim.clearSelection();
    }
  }

  private handleRightClick(e: MouseEvent) {
    const sim = this.sim;
    const hit = this.raycastGroundOrEntity();
    if (!hit) return;

    // Rally if building selected
    if (sim.getSelectedBuilding()) {
      if (hit.type === 'ground') {
        sim.setRallyPoint(hit.position);
        return;
      }
    }

    if (this.attackMoveMode) {
      if (hit.type === 'ground') {
        sim.orderAttackMove(hit.position);
        this.attackMoveMode = false;
        return;
      }
    }

    if (hit.type === 'unit' && hit.nation !== sim.playerNation) {
      sim.orderAttack(hit.id);
    } else if (hit.type === 'building' && hit.nation !== sim.playerNation) {
      sim.orderSiege(hit.id);
    } else if (hit.type === 'resource') {
      sim.orderGather(hit.id);
    } else if (hit.type === 'ground') {
      sim.orderMove(hit.position);
    }
  }

  private raycastGroundOrEntity(): any {
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    // Ground plane y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, target)) {
      // Prefer unit/building hits in full version; simplified ground return
      return { type: 'ground', position: { x: target.x, y: 0, z: target.z } };
    }
    return null;
  }
}
