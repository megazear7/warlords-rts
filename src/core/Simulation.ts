import { EntityId, createEntityId } from './types';
import { Vec3 } from './math';

export interface Unit {
  id: EntityId;
  position: Vec3;
  target?: Vec3;
  speed: number;
  nation: string;
  type: string;
  hp: number;
  maxHp: number;
}

export interface Building {
  id: EntityId;
  position: Vec3;
  type: string;
  nation: string;
  hp: number;
  maxHp: number;
}

export interface Resources {
  food: number;
  timber: number;
  metal: number;
  wealth: number;
  knowledge: number;
}

/**
 * Pure simulation core.
 * No Three.js, no DOM, no rendering knowledge.
 * Deterministic fixed-timestep updates only.
 */
export class Simulation {
  units: Map<EntityId, Unit> = new Map();
  buildings: Map<EntityId, Building> = new Map();
  resources: Resources = {
    food: 200,
    timber: 150,
    metal: 50,
    wealth: 100,
    knowledge: 0,
  };

  /** Currently selected unit ids (player selection) */
  selected: Set<EntityId> = new Set();

  time = 0;

  /** Create a small demo world for Phase 0/1 */
  bootstrapDemoWorld() {
    // Player capital (Rome for now)
    const capitalId = createEntityId();
    this.buildings.set(capitalId, {
      id: capitalId,
      position: { x: 0, y: 0, z: 0 },
      type: 'city_center',
      nation: 'rome',
      hp: 2000,
      maxHp: 2000,
    });

    // A few placeholder citizens near the capital
    for (let i = 0; i < 5; i++) {
      const id = createEntityId();
      const angle = (i / 5) * Math.PI * 2;
      this.units.set(id, {
        id,
        position: {
          x: Math.cos(angle) * 8,
          y: 0,
          z: Math.sin(angle) * 8,
        },
        speed: 4,
        nation: 'rome',
        type: 'citizen',
        hp: 40,
        maxHp: 40,
      });
    }

    // One scout a bit further out
    const scoutId = createEntityId();
    this.units.set(scoutId, {
      id: scoutId,
      position: { x: 25, y: 0, z: 15 },
      speed: 7,
      nation: 'rome',
      type: 'scout',
      hp: 60,
      maxHp: 60,
    });
  }

  step(dt: number) {
    this.time += dt;

    // Simple movement toward targets
    for (const unit of this.units.values()) {
      if (!unit.target) continue;

      const dx = unit.target.x - unit.position.x;
      const dz = unit.target.z - unit.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.15) {
        unit.position.x = unit.target.x;
        unit.position.z = unit.target.z;
        unit.target = undefined;
        continue;
      }

      const step = Math.min(unit.speed * dt, dist);
      unit.position.x += (dx / dist) * step;
      unit.position.z += (dz / dist) * step;
    }
  }

  // ── Selection ──────────────────────────────────────────────

  clearSelection() {
    this.selected.clear();
  }

  selectUnit(id: EntityId, additive = false) {
    if (!additive) this.selected.clear();
    if (this.units.has(id)) {
      this.selected.add(id);
    }
  }

  selectUnits(ids: EntityId[], additive = false) {
    if (!additive) this.selected.clear();
    for (const id of ids) {
      if (this.units.has(id)) this.selected.add(id);
    }
  }

  isSelected(id: EntityId): boolean {
    return this.selected.has(id);
  }

  getSelectedUnits(): Unit[] {
    const result: Unit[] = [];
    for (const id of this.selected) {
      const u = this.units.get(id);
      if (u) result.push(u);
    }
    return result;
  }

  // ── Commands ───────────────────────────────────────────────

  /** Issue a move order to all currently selected units */
  orderMoveSelected(target: Vec3) {
    for (const id of this.selected) {
      this.orderMove(id, target);
    }
  }

  orderMove(unitId: EntityId, target: Vec3) {
    const unit = this.units.get(unitId);
    if (!unit) return;
    unit.target = { ...target };
  }

  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }

  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }
}
