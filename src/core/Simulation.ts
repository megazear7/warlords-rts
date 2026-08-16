import { EntityId, createEntityId } from './types';
import { Vec3, distanceXZ } from './math';

export interface Unit {
  id: EntityId;
  position: Vec3;
  target?: Vec3;
  gatherTargetId?: EntityId;
  speed: number;
  nation: string;
  type: string;
  hp: number;
  maxHp: number;
  carrying?: { type: 'food' | 'timber' | 'metal'; amount: number };
}

export interface Building {
  id: EntityId;
  position: Vec3;
  type: string;
  nation: string;
  hp: number;
  maxHp: number;
  /** Production queue remaining time (seconds) */
  productionTimer?: number;
  productionType?: string;
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

export interface ResearchState {
  science: number;
  civic: number;
  military: number;
  commerce: number;
  /** Currently researching track, if any */
  current?: 'science' | 'civic' | 'military' | 'commerce';
  progress: number; // 0..1
  timeRemaining: number;
}

/**
 * Pure simulation core.
 */
export class Simulation {
  units: Map<EntityId, Unit> = new Map();
  buildings: Map<EntityId, Building> = new Map();
  resourceNodes: Map<EntityId, ResourceNode> = new Map();
  resources: Resources = {
    food: 200,
    timber: 200,
    metal: 80,
    wealth: 100,
    knowledge: 0,
  };

  research: ResearchState = {
    science: 0,
    civic: 0,
    military: 0,
    commerce: 0,
    progress: 0,
    timeRemaining: 0,
  };

  selected: Set<EntityId> = new Set();
  selectedBuildingId: EntityId | null = null;
  time = 0;

  /** Population soft cap (raised later by Military research) */
  popCap = 30;

  bootstrapDemoWorld() {
    const capitalId = createEntityId();
    this.buildings.set(capitalId, {
      id: capitalId,
      position: { x: 0, y: 0, z: 0 },
      type: 'city_center',
      nation: 'rome',
      hp: 2000,
      maxHp: 2000,
    });

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

    // Passive farm income
    for (const b of this.buildings.values()) {
      if (b.type === 'farm') {
        this.resources.food += 1.2 * dt; // ~1.2 food/sec per farm
      }

      // Production queues
      if (b.productionTimer != null && b.productionTimer > 0) {
        b.productionTimer -= dt;
        if (b.productionTimer <= 0) {
          this.finishProduction(b);
        }
      }
    }

    // Research progress
    if (this.research.current && this.research.timeRemaining > 0) {
      this.research.timeRemaining -= dt;
      const total = this.researchTimeFor(this.research.current);
      this.research.progress = 1 - this.research.timeRemaining / total;
      if (this.research.timeRemaining <= 0) {
        this.completeResearch();
      }
    }

    // Units
    for (const unit of this.units.values()) {
      if (unit.type === 'citizen' && unit.gatherTargetId) {
        this.updateGathering(unit, dt);
        continue;
      }

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

    if (dist > 2.2) {
      unit.target = { ...node.position };
      const dx = node.position.x - unit.position.x;
      const dz = node.position.z - unit.position.z;
      const step = Math.min(unit.speed * dt, dist);
      unit.position.x += (dx / dist) * step;
      unit.position.z += (dz / dist) * step;
      return;
    }

    unit.target = undefined;
    const rate = 8;
    const gathered = Math.min(rate * dt, node.amount);
    node.amount -= gathered;

    if (!unit.carrying || unit.carrying.type !== node.type) {
      unit.carrying = { type: node.type, amount: 0 };
    }
    unit.carrying.amount += gathered;

    if (unit.carrying.amount >= 15) {
      this.resources[unit.carrying.type] += unit.carrying.amount;
      unit.carrying = undefined;
    }

    if (node.amount <= 0) {
      unit.gatherTargetId = undefined;
    }
  }

  private finishProduction(b: Building) {
    const type = b.productionType;
    b.productionTimer = undefined;
    b.productionType = undefined;
    if (!type) return;

    if (this.units.size >= this.popCap) return;

    const id = createEntityId();
    const offset = (Math.random() - 0.5) * 4;
    this.units.set(id, {
      id,
      position: {
        x: b.position.x + 3 + offset,
        y: 0,
        z: b.position.z + 3,
      },
      speed: type === 'legionary' ? 3.5 : 4,
      nation: 'rome',
      type,
      hp: type === 'legionary' ? 120 : 40,
      maxHp: type === 'legionary' ? 120 : 40,
    });
  }

  private researchTimeFor(track: string): number {
    // Base 25s, reduced by science level
    const scienceBonus = 1 - this.research.science * 0.08;
    return 25 * Math.max(0.5, scienceBonus);
  }

  private completeResearch() {
    const track = this.research.current;
    if (!track) return;
    this.research[track] += 1;
    this.research.current = undefined;
    this.research.progress = 0;
    this.research.timeRemaining = 0;

    // Military research raises pop cap a bit
    if (track === 'military') {
      this.popCap += 10;
    }
  }

  // ── Selection ──────────────────────────────────────────────

  clearSelection() {
    this.selected.clear();
    this.selectedBuildingId = null;
  }

  selectUnit(id: EntityId, additive = false) {
    if (!additive) {
      this.selected.clear();
      this.selectedBuildingId = null;
    }
    if (this.units.has(id)) this.selected.add(id);
  }

  selectUnits(ids: EntityId[], additive = false) {
    if (!additive) {
      this.selected.clear();
      this.selectedBuildingId = null;
    }
    for (const id of ids) {
      if (this.units.has(id)) this.selected.add(id);
    }
  }

  selectBuilding(id: EntityId) {
    this.selected.clear();
    this.selectedBuildingId = id;
  }

  getSelectedUnits(): Unit[] {
    const result: Unit[] = [];
    for (const id of this.selected) {
      const u = this.units.get(id);
      if (u) result.push(u);
    }
    return result;
  }

  getSelectedBuilding(): Building | null {
    if (!this.selectedBuildingId) return null;
    return this.buildings.get(this.selectedBuildingId) ?? null;
  }

  // ── Commands ───────────────────────────────────────────────

  orderMoveSelected(target: Vec3) {
    for (const id of this.selected) this.orderMove(id, target);
  }

  orderMove(unitId: EntityId, target: Vec3) {
    const unit = this.units.get(unitId);
    if (!unit) return;
    unit.target = { ...target };
    unit.gatherTargetId = undefined;
  }

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

  private placeBuildingNearCitizens(
    type: string,
    costTimber: number,
    costWealth = 0
  ): boolean {
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length === 0) return false;
    if (this.resources.timber < costTimber) return false;
    if (this.resources.wealth < costWealth) return false;

    let ax = 0,
      az = 0;
    for (const c of citizens) {
      ax += c.position.x;
      az += c.position.z;
    }
    ax /= citizens.length;
    az /= citizens.length;

    const pos = {
      x: ax + 5 + Math.random() * 2,
      y: 0,
      z: az + 3 + Math.random() * 2,
    };

    this.resources.timber -= costTimber;
    this.resources.wealth -= costWealth;

    const id = createEntityId();
    this.buildings.set(id, {
      id,
      position: pos,
      type,
      nation: 'rome',
      hp: type === 'barracks' ? 800 : type === 'library' ? 600 : 400,
      maxHp: type === 'barracks' ? 800 : type === 'library' ? 600 : 400,
    });
    return true;
  }

  tryBuildFarm(): boolean {
    return this.placeBuildingNearCitizens('farm', 60);
  }

  tryBuildBarracks(): boolean {
    return this.placeBuildingNearCitizens('barracks', 100, 20);
  }

  tryBuildLibrary(): boolean {
    return this.placeBuildingNearCitizens('library', 80, 40);
  }

  /** Train a legionary at the selected barracks */
  tryTrainLegionary(): boolean {
    const b = this.getSelectedBuilding();
    if (!b || b.type !== 'barracks') return false;
    if (b.productionTimer != null && b.productionTimer > 0) return false;
    if (this.units.size >= this.popCap) return false;

    const costFood = 60;
    const costMetal = 20;
    if (this.resources.food < costFood || this.resources.metal < costMetal) return false;

    this.resources.food -= costFood;
    this.resources.metal -= costMetal;

    b.productionType = 'legionary';
    b.productionTimer = 12; // seconds
    return true;
  }

  /** Start researching the next level of a track (requires Library) */
  tryResearch(track: 'science' | 'civic' | 'military' | 'commerce'): boolean {
    const hasLibrary = [...this.buildings.values()].some((b) => b.type === 'library');
    if (!hasLibrary) return false;
    if (this.research.current) return false;

    const level = this.research[track];
    if (level >= 5) return false; // cap for vertical slice

    const costKnowledge = 40 + level * 30;
    const costWealth = 20 + level * 15;
    if (this.resources.knowledge < costKnowledge) {
      // Allow starting with wealth→knowledge conversion later; for now require knowledge
      // Bootstrap: city center slowly generates a bit of knowledge
    }
    if (this.resources.knowledge < costKnowledge || this.resources.wealth < costWealth) {
      return false;
    }

    this.resources.knowledge -= costKnowledge;
    this.resources.wealth -= costWealth;

    this.research.current = track;
    this.research.timeRemaining = this.researchTimeFor(track);
    this.research.progress = 0;
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
