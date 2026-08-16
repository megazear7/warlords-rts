import { EntityId, createEntityId } from './types';
import { Vec3, distanceXZ } from './math';

export interface Unit {
  id: EntityId;
  position: Vec3;
  target?: Vec3;
  /** If set, unit is gathering this resource node */
  gatherTargetId?: EntityId;
  speed: number;
  nation: string;
  type: string;
  hp: number;
  maxHp: number;
  /** Carried resources before depositing (simple model) */
  carrying?: { type: 'food' | 'timber' | 'metal'; amount: number };
}

export interface Building {
  id: EntityId;
  position: Vec3;
  type: string;
  nation: string;
  hp: number;
  maxHp: number;
}

export interface ResourceNode {
  id: EntityId;
  position: Vec3;
  type: 'food' | 'timber' | 'metal';
  amount: number;
  maxAmount: number;
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
  resourceNodes: Map<EntityId, ResourceNode> = new Map();
  resources: Resources = {
    food: 200,
    timber: 150,
    metal: 50,
    wealth: 100,
    knowledge: 0,
  };

  selected: Set<EntityId> = new Set();
  time = 0;

  /** Create a small demo world */
  bootstrapDemoWorld() {
    // Player capital (Rome)
    const capitalId = createEntityId();
    this.buildings.set(capitalId, {
      id: capitalId,
      position: { x: 0, y: 0, z: 0 },
      type: 'city_center',
      nation: 'rome',
      hp: 2000,
      maxHp: 2000,
    });

    // Citizens
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

    // Scout
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

    // Resource nodes
    this.spawnResourceNode('food', { x: 18, y: 0, z: -12 }, 300);
    this.spawnResourceNode('food', { x: -15, y: 0, z: 20 }, 280);
    this.spawnResourceNode('timber', { x: -22, y: 0, z: -8 }, 400);
    this.spawnResourceNode('timber', { x: 30, y: 0, z: 8 }, 350);
    this.spawnResourceNode('metal', { x: 12, y: 0, z: 28 }, 200);
  }

  private spawnResourceNode(
    type: 'food' | 'timber' | 'metal',
    position: Vec3,
    amount: number
  ) {
    const id = createEntityId();
    this.resourceNodes.set(id, {
      id,
      position: { ...position },
      type,
      amount,
      maxAmount: amount,
    });
  }

  step(dt: number) {
    this.time += dt;

    for (const unit of this.units.values()) {
      // Gathering logic for citizens
      if (unit.type === 'citizen' && unit.gatherTargetId) {
        this.updateGathering(unit, dt);
        continue;
      }

      // Movement toward target
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

  private updateGathering(unit: Unit, dt: number) {
    const node = this.resourceNodes.get(unit.gatherTargetId!);
    if (!node || node.amount <= 0) {
      unit.gatherTargetId = undefined;
      unit.target = undefined;
      return;
    }

    const dist = distanceXZ(unit.position, node.position);

    // Move toward the node if not close enough
    if (dist > 2.2) {
      unit.target = { ...node.position };
      const dx = node.position.x - unit.position.x;
      const dz = node.position.z - unit.position.z;
      const step = Math.min(unit.speed * dt, dist);
      unit.position.x += (dx / dist) * step;
      unit.position.z += (dz / dist) * step;
      return;
    }

    // In range → gather
    unit.target = undefined;
    const rate = 8; // resources per second
    const gathered = Math.min(rate * dt, node.amount);
    node.amount -= gathered;

    if (!unit.carrying || unit.carrying.type !== node.type) {
      unit.carrying = { type: node.type, amount: 0 };
    }
    unit.carrying.amount += gathered;

    // Deposit when carrying enough (simple auto-deposit to global stockpile)
    if (unit.carrying.amount >= 15) {
      this.resources[unit.carrying.type] += unit.carrying.amount;
      unit.carrying = undefined;
    }

    if (node.amount <= 0) {
      unit.gatherTargetId = undefined;
    }
  }

  // ── Selection ──────────────────────────────────────────────

  clearSelection() {
    this.selected.clear();
  }

  selectUnit(id: EntityId, additive = false) {
    if (!additive) this.selected.clear();
    if (this.units.has(id)) this.selected.add(id);
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

  orderMoveSelected(target: Vec3) {
    for (const id of this.selected) {
      this.orderMove(id, target);
    }
  }

  orderMove(unitId: EntityId, target: Vec3) {
    const unit = this.units.get(unitId);
    if (!unit) return;
    unit.target = { ...target };
    unit.gatherTargetId = undefined; // cancel gathering
  }

  /** Order selected citizens to gather from a resource node */
  orderGatherSelected(nodeId: EntityId) {
    const node = this.resourceNodes.get(nodeId);
    if (!node || node.amount <= 0) return;

    for (const id of this.selected) {
      const unit = this.units.get(id);
      if (!unit || unit.type !== 'citizen') continue;
      unit.gatherTargetId = nodeId;
      unit.target = { ...node.position };
    }
  }

  /** Try to place a farm near the average position of selected citizens */
  tryBuildFarm(): boolean {
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length === 0) return false;

    const cost = { food: 0, timber: 60, wealth: 0 };
    if (this.resources.timber < cost.timber) return false;

    // Average position of selected citizens, offset a bit
    let ax = 0,
      az = 0;
    for (const c of citizens) {
      ax += c.position.x;
      az += c.position.z;
    }
    ax /= citizens.length;
    az /= citizens.length;

    // Place slightly away from the group
    const pos = { x: ax + 4, y: 0, z: az + 2 };

    this.resources.timber -= cost.timber;

    const id = createEntityId();
    this.buildings.set(id, {
      id,
      position: pos,
      type: 'farm',
      nation: 'rome',
      hp: 400,
      maxHp: 400,
    });

    // Farms slowly generate food
    return true;
  }

  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }

  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  getAllResourceNodes(): ResourceNode[] {
    return Array.from(this.resourceNodes.values());
  }
}
