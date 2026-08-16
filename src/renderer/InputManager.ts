import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Simulation } from '../core/Simulation';
import { EntityId } from '../core/types';
import type { Game } from '../Game';
import { audio } from '../audio/AudioManager';

const EDGE_MARGIN = 28;

export class InputManager {
  private renderer: Renderer;
  private simulation: Simulation | null = null;
  private game: Game | null = null;

  private isLeftDown = false;
  private isRightDown = false;
  private isPanning = false;
  private isOrbiting = false;
  private isBoxSelecting = false;

  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private mouseX = 0;
  private mouseY = 0;
  private lastClickTime = 0;
  private lastClickUnitType: string | null = null;

  private readonly DRAG_THRESHOLD = 5;
  private panMul = 1;
  private zoomMul = 1;
  private edgeScroll = true;
  /** A-key attack-move mode (next ground click) */
  private attackMoveMode = false;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private selectionBoxEl: HTMLDivElement;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    const el = renderer.domElement;

    this.selectionBoxEl = document.createElement('div');
    this.selectionBoxEl.style.cssText = `
      position: absolute; border: 1px solid #44ff88;
      background: rgba(68, 255, 136, 0.12);
      pointer-events: none; display: none; z-index: 20;
    `;
    document.getElementById('app')?.appendChild(this.selectionBoxEl);

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('mousedown', (e) => {
      if (!this.isGameplay()) return;
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
      if (!this.isGameplay()) {
        this.isLeftDown = this.isRightDown = false;
        return;
      }
      if (e.button === 0 && this.isLeftDown) {
        const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
        if (this.isBoxSelecting) this.finishBoxSelect(e.clientX, e.clientY, e.shiftKey);
        else if (dist < this.DRAG_THRESHOLD) this.handleSelectClick(e.clientX, e.clientY, e.shiftKey);
        this.isLeftDown = false;
        this.isPanning = false;
        this.isBoxSelecting = false;
        this.selectionBoxEl.style.display = 'none';
      }
      if ((e.button === 2 || e.button === 1) && this.isRightDown) {
        const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
        if (dist < this.DRAG_THRESHOLD) this.handleRightClick(e.clientX, e.clientY);
        this.isRightDown = false;
        this.isOrbiting = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (!this.isGameplay()) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      if (this.isLeftDown) {
        const totalDist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
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
        const totalDist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
        if (!this.isOrbiting && totalDist > this.DRAG_THRESHOLD) this.isOrbiting = true;
        if (this.isOrbiting) this.orbit(dx, dy);
      }
    });

    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.isGameplay()) return;
        e.preventDefault();
        this.zoom(e.deltaY);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.game) {
        this.game.togglePause();
        return;
      }

      if (!this.isGameplay() || !this.simulation) return;
      const sim = this.simulation;

      const digitMatch = e.code.match(/^Digit(\d)$/);
      if (digitMatch) {
        const slot = Number(digitMatch[1]);
        if (e.ctrlKey || e.metaKey) {
          sim.setControlGroup(slot);
          this.game?.ui.showToast(`Control group ${slot} set`);
          e.preventDefault();
          return;
        }
        sim.selectControlGroup(slot);
        return;
      }

      switch (e.code) {
        case 'KeyA':
          this.attackMoveMode = true;
          this.game?.ui.showToast('Attack-move: right-click destination');
          break;
        case 'KeyF':
          if (sim.tryBuildFarm()) audio.play('build_place');
          break;
        case 'KeyB':
          if (sim.tryBuildBarracks()) audio.play('build_place');
          break;
        case 'KeyL':
          if (sim.tryBuildLibrary()) audio.play('build_place');
          break;
        case 'KeyY':
          if (sim.tryBuildTower()) audio.play('build_place');
          else this.game?.ui.showToast('Need Military research 1+ · select citizens · 80 timber, 30 wealth');
          break;
        case 'KeyM':
          if (sim.tryBuildMarket()) audio.play('build_place');
          else this.game?.ui.showToast('Need Commerce research 1+ · select citizens · 70 timber, 25 wealth');
          break;
        case 'KeyH':
          if (sim.tryBuildWall()) audio.play('build_place');
          else this.game?.ui.showToast('Need Military research 2+ · select citizens · 40 timber, 20 wealth');
          break;
        case 'KeyU':
          if (sim.executeTrade('food', 'wealth', 50)) this.game?.ui.showToast('Sold 50 food for wealth');
          else this.game?.ui.showToast(sim.checkTrade('food', 'wealth', 50) ?? 'Trade failed');
          break;
        case 'KeyI':
          if (sim.executeTrade('wealth', 'metal', 20)) this.game?.ui.showToast('Bought 20 metal');
          else this.game?.ui.showToast(sim.checkTrade('wealth', 'metal', 20) ?? 'Trade failed');
          break;
        case 'KeyO':
          if (sim.executeTrade('timber', 'wealth', 50)) this.game?.ui.showToast('Sold 50 timber for wealth');
          else this.game?.ui.showToast(sim.checkTrade('timber', 'wealth', 50) ?? 'Trade failed');
          break;
        case 'KeyP':
          if (sim.executeTrade('wealth', 'timber', 50)) this.game?.ui.showToast('Bought 50 timber');
          else this.game?.ui.showToast(sim.checkTrade('wealth', 'timber', 50) ?? 'Trade failed');
          break;
        case 'KeyV':
          if (!sim.tryTrainCitizen()) {
            this.game?.ui.showToast('Select city center · costs 50 food');
          }
          break;
        case 'KeyT':
          sim.tryTrainLegionary();
          break;
        case 'KeyR':
          if (!sim.tryTrainElite()) this.game?.ui.showToast('Elite unit locked (advance epoch)');
          break;
        case 'KeyQ':
          sim.tryTrainScout();
          break;
        case 'KeyW':
          sim.tryTrainSupplyWagon();
          break;
        case 'KeyG':
          if (!sim.tryTrainGeneral()) {
            this.game?.ui.showToast('Select barracks · needs Military research 1+ · max 2 generals');
          } else {
            this.game?.ui.showToast('Training General (aura: +25% attack, +12% speed)');
          }
          break;
        case 'KeyC':
          if (sim.tryFoundCity()) audio.play('build_place');
          break;
        case 'KeyE': {
          const ok = sim.tryAdvanceEpoch();
          if (ok) this.game?.ui.showToast(`Epoch: ${sim.getCurrentEpochName()}`);
          else this.game?.ui.showToast('Cannot advance epoch (cost or max)');
          break;
        }
        case 'KeyS':
          if (!e.ctrlKey) this.game?.saveSlot(1);
          break;
        case 'F1':
          sim.tryResearch('science');
          break;
        case 'F2':
          sim.tryResearch('civic');
          break;
        case 'F3':
          sim.tryResearch('military');
          break;
        case 'F4':
          sim.tryResearch('commerce');
          break;
      }
    });
  }

  setSimulation(sim: Simulation) {
    this.simulation = sim;
  }

  setGame(game: Game) {
    this.game = game;
  }

  setPanSpeedMultiplier(m: number) {
    this.panMul = m;
  }

  setZoomSpeedMultiplier(m: number) {
    this.zoomMul = m;
  }

  setEdgeScroll(enabled: boolean) {
    this.edgeScroll = enabled;
  }

  /** Call each frame while playing */
  updateEdgeScroll(dt: number) {
    if (!this.edgeScroll || !this.isGameplay()) return;
    if (this.isLeftDown || this.isRightDown || this.isBoxSelecting) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    let dx = 0;
    let dy = 0;
    if (this.mouseX < EDGE_MARGIN) dx = -1;
    else if (this.mouseX > w - EDGE_MARGIN) dx = 1;
    if (this.mouseY < EDGE_MARGIN) dy = -1;
    else if (this.mouseY > h - EDGE_MARGIN) dy = 1;
    if (dx === 0 && dy === 0) return;

    const pixels = 420 * dt * this.panMul;
    this.pan(dx * pixels, dy * pixels);
  }

  private isGameplay(): boolean {
    return this.game?.mode === 'playing';
  }

  private updateSelectionBox(clientX: number, clientY: number) {
    const x = Math.min(this.downX, clientX);
    const y = Math.min(this.downY, clientY);
    this.selectionBoxEl.style.left = `${x}px`;
    this.selectionBoxEl.style.top = `${y}px`;
    this.selectionBoxEl.style.width = `${Math.abs(clientX - this.downX)}px`;
    this.selectionBoxEl.style.height = `${Math.abs(clientY - this.downY)}px`;
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
      if (unit.nation !== this.simulation.playerNation) continue;
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
      const unit = this.simulation.units.get(hitUnitId);
      const now = performance.now();
      if (
        unit &&
        this.lastClickUnitType === unit.type &&
        now - this.lastClickTime < 350 &&
        !additive
      ) {
        this.simulation.selectAllOfType(unit.type);
        this.lastClickTime = 0;
        this.lastClickUnitType = null;
        return;
      }
      this.lastClickTime = now;
      this.lastClickUnitType = unit?.type ?? null;
      this.simulation.selectUnit(hitUnitId, additive);
      return;
    }
    this.lastClickUnitType = null;
    const hitBuildingId = this.raycastWithUserData(clientX, clientY, 'buildingId');
    if (hitBuildingId) {
      this.simulation.selectBuilding(hitBuildingId);
      return;
    }
    if (!additive) this.simulation.clearSelection();
  }

  private handleRightClick(clientX: number, clientY: number) {
    if (!this.simulation) return;

    if (this.simulation.selected.size === 0 && this.simulation.selectedBuildingId) {
      const point = this.raycastGround(clientX, clientY);
      if (point && this.simulation.setRallyPoint({ x: point.x, y: 0, z: point.z })) {
        audio.play('ui_confirm');
        this.game?.ui.showToast('Rally point set');
        return;
      }
    }

    if (this.simulation.selected.size === 0) return;

    const hitUnitId = this.raycastWithUserData(clientX, clientY, 'unitId');
    if (hitUnitId) {
      const unit = this.simulation.units.get(hitUnitId);
      if (unit && unit.nation !== this.simulation.playerNation) {
        this.simulation.orderAttackSelected(hitUnitId);
        audio.play('order_attack');
        return;
      }
    }

    const hitBuildingId = this.raycastWithUserData(clientX, clientY, 'buildingId');
    if (hitBuildingId) {
      const b = this.simulation.buildings.get(hitBuildingId);
      if (b && b.nation !== this.simulation.playerNation) {
        this.simulation.orderAttackBuildingSelected(hitBuildingId);
        audio.play('order_attack');
        return;
      }
    }

    const nodeId = this.raycastWithUserData(clientX, clientY, 'resourceNodeId');
    if (nodeId) {
      this.simulation.orderGatherSelected(nodeId);
      audio.play('order_gather');
      return;
    }

    const point = this.raycastGround(clientX, clientY);
    if (point) {
      if (this.attackMoveMode) {
        this.simulation.orderAttackMoveSelected({ x: point.x, y: 0, z: point.z });
        this.attackMoveMode = false;
        audio.play('order_attack');
      } else {
        this.simulation.orderMoveSelected({ x: point.x, y: 0, z: point.z });
        audio.play('order_move');
      }
    }
  }

  private raycastWithUserData(clientX: number, clientY: number, key: string): EntityId | null {
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
    return this.raycaster.ray.intersectPlane(this.groundPlane, target) ? target : null;
  }

  private updateMouseNDC(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pan(dx: number, dy: number) {
    const r = this.renderer;
    const speed = r.cameraDistance * 0.0018 * this.panMul;
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
      r.cameraDistance + deltaY * 0.04 * this.zoomMul,
      15,
      140
    );
  }
}
